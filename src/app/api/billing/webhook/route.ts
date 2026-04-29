import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { type PlanTier, type SubscriptionStatus } from "@/lib/subscriptions";

function inferPlanTierFromPriceId(priceId: string | null): PlanTier {
    if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) {
        return "pro";
    }

    if (priceId && priceId === process.env.STRIPE_PLUS_PRICE_ID) {
        return "plus";
    }

    return "free";
}

function toIso(seconds?: number | null) {
    return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function persistSubscription(
    customerId: string,
    subscription: Stripe.Subscription | null,
    overrides?: Partial<{
        status: SubscriptionStatus;
        plan_tier: PlanTier;
        cancel_at_period_end: boolean;
        is_disabled: boolean;
        grace_until: string | null;
    }>,
) {
    console.log("[webhook] persistSubscription called", { customerId, subscriptionId: subscription?.id, overrides });

    const { data: record, error: lookupError } = await supabaseAdmin
        .from("professor_subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

    if (lookupError) {
        console.error("[webhook] DB lookup error for customer", customerId, lookupError);
    }

    if (!record?.user_id) {
        console.warn("[webhook] No professor_subscriptions row found for stripe_customer_id:", customerId);
        return;
    }

    console.log("[webhook] Found user_id:", record.user_id, "for customer:", customerId);

    const priceId = subscription?.items.data[0]?.price.id || null;
    const status = (subscription?.status || "free") as SubscriptionStatus;
    const periodStart = subscription?.items.data[0]?.current_period_start ?? null;
    const periodEnd = subscription?.items.data[0]?.current_period_end ?? null;
    const planTierFromMeta = subscription?.metadata?.target_plan as PlanTier | undefined;
    const resolvedTier = overrides?.plan_tier || planTierFromMeta || inferPlanTierFromPriceId(priceId);

    console.log("[webhook] Resolved values", {
        priceId,
        status,
        planTierFromMeta,
        inferredTier: inferPlanTierFromPriceId(priceId),
        resolvedTier,
        periodStart,
        periodEnd,
        envPlusPriceId: process.env.STRIPE_PLUS_PRICE_ID,
        envProPriceId: process.env.STRIPE_PRO_PRICE_ID,
    });

    const { error: updateError } = await supabaseAdmin
        .from("professor_subscriptions")
        .update({
            plan_tier: resolvedTier,
            status: overrides?.status || status,
            stripe_subscription_id: subscription?.id || null,
            stripe_price_id: priceId,
            current_period_start: toIso(periodStart),
            current_period_end: toIso(periodEnd),
            cancel_at_period_end:
                overrides?.cancel_at_period_end ?? Boolean(subscription?.cancel_at_period_end),
            grace_until:
                overrides?.grace_until ??
                toIso(periodEnd),
            is_disabled: overrides?.is_disabled ?? false,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", record.user_id);

    if (updateError) {
        console.error("[webhook] DB update error for user", record.user_id, updateError);
    } else {
        console.log("[webhook] Successfully updated subscription for user", record.user_id, "to tier:", resolvedTier);
    }
}

export async function POST(request: Request) {
    console.log("[webhook] ========== Stripe webhook received ==========");

    const signature = (await headers()).get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        console.error("[webhook] Missing signature or webhook secret", { hasSignature: !!signature, hasSecret: !!webhookSecret });
        return NextResponse.json(
            { error: "Stripe webhook is not configured." },
            { status: 400 },
        );
    }

    const body = await request.text();
    const stripe = getStripeClient();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
        console.error("[webhook] Signature verification failed:", error instanceof Error ? error.message : error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Invalid signature." },
            { status: 400 },
        );
    }

    console.log("[webhook] Event verified:", event.type, "| Event ID:", event.id);

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log("[webhook] checkout.session.completed", {
                customerId: session.customer,
                subscriptionRef: session.subscription,
                metadata: session.metadata,
            });
            if (session.customer && typeof session.customer === "string") {
                const subscriptionId =
                    typeof session.subscription === "string"
                        ? session.subscription
                        : session.subscription?.id;
                const subscription = subscriptionId
                    ? await stripe.subscriptions.retrieve(subscriptionId)
                    : null;
                console.log("[webhook] Retrieved subscription:", subscription?.id, "status:", subscription?.status);
                await persistSubscription(session.customer, subscription);
            } else {
                console.warn("[webhook] checkout.session.completed but customer is not a string:", session.customer);
            }
            break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`[webhook] ${event.type}`, {
                subscriptionId: subscription.id,
                customerId: subscription.customer,
                status: subscription.status,
                metadata: subscription.metadata,
            });
            if (typeof subscription.customer === "string") {
                await persistSubscription(subscription.customer, subscription);
            } else {
                console.warn(`[webhook] ${event.type} but customer is not a string:`, subscription.customer);
            }
            break;
        }
        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            console.log("[webhook] customer.subscription.deleted", {
                subscriptionId: subscription.id,
                customerId: subscription.customer,
            });
            if (typeof subscription.customer === "string") {
                await persistSubscription(subscription.customer, subscription, {
                    status: "canceled",
                    plan_tier: "free",
                    is_disabled: true,
                });
            }
            break;
        }
        default:
            console.log("[webhook] Unhandled event type:", event.type);
            break;
    }

    console.log("[webhook] ========== Webhook processing complete ==========");
    return NextResponse.json({ received: true });
}
