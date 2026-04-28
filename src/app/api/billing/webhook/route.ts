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
    const { data: record } = await supabaseAdmin
        .from("professor_subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

    if (!record?.user_id) {
        return;
    }

    const priceId = subscription?.items.data[0]?.price.id || null;
    const status = (subscription?.status || "free") as SubscriptionStatus;
    const periodStart = subscription?.items.data[0]?.current_period_start ?? null;
    const periodEnd = subscription?.items.data[0]?.current_period_end ?? null;
    const planTierFromMeta = subscription?.metadata?.target_plan as PlanTier | undefined;

    await supabaseAdmin
        .from("professor_subscriptions")
        .update({
            plan_tier: overrides?.plan_tier || planTierFromMeta || inferPlanTierFromPriceId(priceId),
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
}

export async function POST(request: Request) {
    const signature = (await headers()).get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
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
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Invalid signature." },
            { status: 400 },
        );
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.customer && typeof session.customer === "string") {
                const subscriptionId =
                    typeof session.subscription === "string"
                        ? session.subscription
                        : session.subscription?.id;
                const subscription = subscriptionId
                    ? await stripe.subscriptions.retrieve(subscriptionId)
                    : null;
                await persistSubscription(session.customer, subscription);
            }
            break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            if (typeof subscription.customer === "string") {
                await persistSubscription(subscription.customer, subscription);
            }
            break;
        }
        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
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
            break;
    }

    return NextResponse.json({ received: true });
}
