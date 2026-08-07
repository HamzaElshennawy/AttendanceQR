import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "@/lib/logger";
import {
    getStripeClient,
    getStripeWebhookSecret,
    resolvePriceId,
    subscriptionIdFromInvoice,
} from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
    normalizePlanTier,
    type BillingInterval,
    type PlanTier,
    type SubscriptionStatus,
} from "@/lib/plans";

// Signature verification needs Node crypto, and the raw body must not be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dunning window granted when a renewal payment fails. */
const GRACE_DAYS_AFTER_PAYMENT_FAILURE = 7;

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toIso(seconds?: number | null) {
    return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function logWebhookEvent(entry: {
    stripe_event_id: string;
    event_type: string;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    user_id?: string | null;
    resolved_plan_tier?: string | null;
    status?: string | null;
    payload?: Record<string, unknown> | null;
    error?: string | null;
}) {
    try {
        await supabaseAdmin.from("webhook_logs").insert({
            stripe_event_id: entry.stripe_event_id,
            event_type: entry.event_type,
            stripe_customer_id: entry.stripe_customer_id ?? null,
            stripe_subscription_id: entry.stripe_subscription_id ?? null,
            user_id: entry.user_id ?? null,
            resolved_plan_tier: entry.resolved_plan_tier ?? null,
            status: entry.status ?? null,
            payload: entry.payload ?? null,
            error: entry.error ?? null,
        });
    } catch (error) {
        // The audit trail is best-effort; never fail an event because of it.
        logger.error("Failed to write webhook_log", { error });
    }
}

/**
 * Idempotency claim.
 *
 * Stripe retries on any non-2xx and can deliver the same event more than once.
 * Inserting against the primary key means only the first delivery proceeds.
 * Returns false when the event has already been handled.
 */
async function claimEvent(eventId: string, eventType: string): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from("stripe_processed_events")
        .insert({ stripe_event_id: eventId, event_type: eventType });

    if (!error) {
        return true;
    }

    if (error.code === "23505") {
        return false;
    }

    throw error;
}

/**
 * Released when handling fails, so Stripe's retry is allowed to try again
 * rather than being rejected as a duplicate.
 */
async function releaseEvent(eventId: string) {
    try {
        await supabaseAdmin
            .from("stripe_processed_events")
            .delete()
            .eq("stripe_event_id", eventId);
    } catch (error) {
        logger.error("Failed to release event claim", { eventId, error });
    }
}

/**
 * Metadata first, customer lookup second.
 *
 * The original implementation only looked up by `stripe_customer_id` and gave
 * up silently when no row matched — so a subscription created outside our
 * checkout flow, or one whose customer id failed to persist, left a paying
 * customer with no access and no trace. Checkout sets `user_id` on both the
 * session and the subscription, so that is the reliable link.
 */
async function resolveUserId(args: {
    metadataUserId?: string | null;
    customerId?: string | null;
}): Promise<string | null> {
    const fromMetadata = args.metadataUserId?.trim();

    if (fromMetadata && UUID_PATTERN.test(fromMetadata)) {
        return fromMetadata;
    }

    if (!args.customerId) {
        return null;
    }

    const { data } = await supabaseAdmin
        .from("professor_subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", args.customerId)
        .maybeSingle();

    return data?.user_id ?? null;
}

interface PersistOverrides {
    status?: SubscriptionStatus;
    plan_tier?: PlanTier;
    cancel_at_period_end?: boolean;
    is_disabled?: boolean;
    grace_until?: string | null;
}

async function persistSubscription(args: {
    customerId: string | null;
    subscription: Stripe.Subscription | null;
    metadataUserId?: string | null;
    eventId: string;
    eventType: string;
    eventCreated: number;
    overrides?: PersistOverrides;
}) {
    const { customerId, subscription, eventId, eventType, eventCreated } = args;

    const userId = await resolveUserId({
        metadataUserId:
            args.metadataUserId ?? subscription?.metadata?.user_id ?? null,
        customerId,
    });

    if (!userId) {
        // Retrying will not produce a link that does not exist, so this is
        // logged loudly rather than retried forever.
        logger.error("Stripe event could not be matched to a user", {
            eventId,
            eventType,
            customerId,
            subscriptionId: subscription?.id,
        });
        await logWebhookEvent({
            stripe_event_id: eventId,
            event_type: eventType,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription?.id,
            error: "Unresolvable user: no metadata.user_id and no matching stripe_customer_id.",
        });
        return;
    }

    const { data: existing } = await supabaseAdmin
        .from("professor_subscriptions")
        .select(
            "plan_tier, billing_interval, last_stripe_event_at, has_used_trial, trial_started_at, trial_ends_at",
        )
        .eq("user_id", userId)
        .maybeSingle();

    // Stripe does not guarantee ordering. Without this, a stale
    // subscription.updated arriving after subscription.deleted would resurrect
    // a cancelled subscription.
    const eventAt = new Date(eventCreated * 1000);

    if (
        existing?.last_stripe_event_at &&
        new Date(existing.last_stripe_event_at).getTime() > eventAt.getTime()
    ) {
        logger.warn("Ignoring out-of-order Stripe event", {
            eventId,
            eventType,
            userId,
            eventAt: eventAt.toISOString(),
            lastProcessedAt: existing.last_stripe_event_at,
        });
        return;
    }

    const item = subscription?.items.data[0];
    const priceId = item?.price.id ?? null;
    const resolvedPrice = resolvePriceId(priceId);

    if (priceId && !resolvedPrice) {
        // Never silently downgrade: an unmapped price means the environment is
        // misconfigured, not that the customer is on Free.
        logger.error("Unrecognised Stripe price id — check price env vars", {
            eventId,
            eventType,
            userId,
            priceId,
        });
    }

    let planTier: PlanTier;

    if (args.overrides?.plan_tier) {
        planTier = args.overrides.plan_tier;
    } else if (resolvedPrice) {
        planTier = resolvedPrice.tier;
    } else if (priceId) {
        // Unmapped price: keep whatever they already had rather than dropping
        // a paying customer to Free.
        planTier = normalizePlanTier(existing?.plan_tier);
    } else {
        planTier = "free";
    }

    const billingInterval: BillingInterval =
        resolvedPrice?.interval ??
        ((existing?.billing_interval as BillingInterval | undefined) ?? "month");

    const status =
        args.overrides?.status ??
        ((subscription?.status as SubscriptionStatus | undefined) ?? "free");

    const periodEnd = item?.current_period_end ?? null;

    // Stripe keeps trial_start / trial_end populated after a trial converts, so
    // these stay accurate for the life of the subscription rather than being
    // wiped on the first renewal.
    //
    // Only the subscription object is authoritative about the trial window. An
    // event that carries no subscription says nothing about it, so the stored
    // dates are kept rather than overwritten with null — blanking trial_ends_at
    // mid-trial would leave the countdown with nothing to count.
    const trialStartIso = subscription
        ? toIso(subscription.trial_start ?? null)
        : (existing?.trial_started_at ?? null);
    const trialEndIso = subscription
        ? toIso(subscription.trial_end ?? null)
        : (existing?.trial_ends_at ?? null);

    // Sticky in both directions: once true it never goes back to false, and a
    // subscription that carries a trial window sets it even if the flag was
    // somehow missed when the trial began. This is the only thing standing
    // between us and a customer who cancels and re-trials indefinitely.
    const hasUsedTrial =
        Boolean(existing?.has_used_trial) || trialEndIso !== null;

    const { error: upsertError } = await supabaseAdmin
        .from("professor_subscriptions")
        .upsert(
            {
                user_id: userId,
                plan_tier: planTier,
                billing_interval: billingInterval,
                status,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription?.id ?? null,
                stripe_price_id: priceId,
                current_period_start: toIso(item?.current_period_start ?? null),
                current_period_end: toIso(periodEnd),
                cancel_at_period_end:
                    args.overrides?.cancel_at_period_end ??
                    Boolean(subscription?.cancel_at_period_end),
                grace_until:
                    args.overrides?.grace_until !== undefined
                        ? args.overrides.grace_until
                        : toIso(periodEnd),
                is_disabled: args.overrides?.is_disabled ?? false,
                // Authoritative: Stripe keeps a paused subscription at status
                // "active", so entitlements read this column instead.
                paused_until: subscription?.pause_collection
                    ? toIso(subscription.pause_collection.resumes_at)
                    : null,
                trial_started_at: trialStartIso,
                trial_ends_at: trialEndIso,
                has_used_trial: hasUsedTrial,
                last_stripe_event_at: eventAt.toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
        );

    if (upsertError) {
        await logWebhookEvent({
            stripe_event_id: eventId,
            event_type: eventType,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription?.id,
            user_id: userId,
            resolved_plan_tier: planTier,
            status,
            error: `DB upsert error: ${upsertError.message}`,
        });

        // Thrown so the handler returns 500 and Stripe retries. Previously this
        // was logged and the handler still returned 200, so a failed write was
        // never retried and the subscription silently stayed wrong.
        throw new Error(`Failed to persist subscription: ${upsertError.message}`);
    }

    await logWebhookEvent({
        stripe_event_id: eventId,
        event_type: eventType,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription?.id,
        user_id: userId,
        resolved_plan_tier: planTier,
        status,
        payload: {
            priceId,
            billingInterval,
            trialEndsAt: trialEndIso,
            hasUsedTrial,
        },
    });
}

async function handleEvent(event: Stripe.Event) {
    const stripe = getStripeClient();

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const customerId =
                typeof session.customer === "string"
                    ? session.customer
                    : (session.customer?.id ?? null);

            const subscriptionId =
                typeof session.subscription === "string"
                    ? session.subscription
                    : (session.subscription?.id ?? null);

            const subscription = subscriptionId
                ? await stripe.subscriptions.retrieve(subscriptionId)
                : null;

            await persistSubscription({
                customerId,
                subscription,
                metadataUserId:
                    session.metadata?.user_id ?? session.client_reference_id,
                eventId: event.id,
                eventType: event.type,
                eventCreated: event.created,
            });
            break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.paused":
        case "customer.subscription.resumed":
        // Fires three days before a trial converts. Its data object is a
        // Subscription like the rest, so persisting it keeps trial_ends_at
        // fresh — and gives the audit trail a record of the warning, which is
        // the hook a "your trial ends soon" email would later attach to.
        case "customer.subscription.trial_will_end": {
            const subscription = event.data.object as Stripe.Subscription;

            await persistSubscription({
                customerId:
                    typeof subscription.customer === "string"
                        ? subscription.customer
                        : subscription.customer.id,
                subscription,
                eventId: event.id,
                eventType: event.type,
                eventCreated: event.created,
            });
            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;

            await persistSubscription({
                customerId:
                    typeof subscription.customer === "string"
                        ? subscription.customer
                        : subscription.customer.id,
                subscription,
                eventId: event.id,
                eventType: event.type,
                eventCreated: event.created,
                overrides: {
                    status: "canceled",
                    plan_tier: "free",
                    is_disabled: true,
                    grace_until: null,
                },
            });
            break;
        }

        case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const subscriptionId = subscriptionIdFromInvoice(invoice);

            if (!subscriptionId) {
                // One-off invoice, nothing subscription-shaped to update.
                break;
            }

            const subscription =
                await stripe.subscriptions.retrieve(subscriptionId);

            // Access is retained for the dunning window rather than cut off
            // immediately. Previously grace_until was set to the period end,
            // which for a past-due subscription is already in the past — so a
            // single failed payment locked the customer out instantly.
            await persistSubscription({
                customerId:
                    typeof invoice.customer === "string"
                        ? invoice.customer
                        : (invoice.customer?.id ?? null),
                subscription,
                eventId: event.id,
                eventType: event.type,
                eventCreated: event.created,
                overrides: {
                    status: "past_due",
                    grace_until: daysFromNow(GRACE_DAYS_AFTER_PAYMENT_FAILURE),
                },
            });
            break;
        }

        case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            const subscriptionId = subscriptionIdFromInvoice(invoice);

            if (!subscriptionId) {
                break;
            }

            const subscription =
                await stripe.subscriptions.retrieve(subscriptionId);

            // Recovery: grace reverts to the normal period end.
            await persistSubscription({
                customerId:
                    typeof invoice.customer === "string"
                        ? invoice.customer
                        : (invoice.customer?.id ?? null),
                subscription,
                eventId: event.id,
                eventType: event.type,
                eventCreated: event.created,
            });
            break;
        }

        default:
            logger.debug("Unhandled Stripe event type", { type: event.type });
            break;
    }
}

export async function POST(request: Request) {
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "Missing stripe-signature header." },
            { status: 400 },
        );
    }

    const body = await request.text();

    let event: Stripe.Event;

    try {
        event = getStripeClient().webhooks.constructEvent(
            body,
            signature,
            getStripeWebhookSecret(),
        );
    } catch (error) {
        logger.error("Stripe webhook signature verification failed", { error });
        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Invalid signature.",
            },
            { status: 400 },
        );
    }

    let claimed = false;

    try {
        claimed = await claimEvent(event.id, event.type);
    } catch (error) {
        logger.error("Failed to claim Stripe event", { eventId: event.id, error });
        // Return 500 so Stripe retries — dropping it here would lose the event.
        return NextResponse.json({ error: "Internal error." }, { status: 500 });
    }

    if (!claimed) {
        logger.info("Skipping duplicate Stripe event", {
            eventId: event.id,
            type: event.type,
        });
        return NextResponse.json({ received: true, duplicate: true });
    }

    try {
        await handleEvent(event);
    } catch (error) {
        await releaseEvent(event.id);
        logger.error("Stripe webhook handler failed", {
            eventId: event.id,
            type: event.type,
            error,
        });
        return NextResponse.json({ error: "Internal error." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
