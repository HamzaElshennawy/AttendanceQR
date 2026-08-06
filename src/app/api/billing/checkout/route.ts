import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getAppBaseUrl, getStripeClient, getStripePriceId } from "@/lib/stripe";
import { getOrCreateSubscriptionRecord } from "@/lib/subscriptions";
import {
    ACTIVE_SUBSCRIPTION_STATUSES,
    normalizeBillingInterval,
    normalizePlanTier,
    type PaidPlanTier,
} from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetPlan = normalizePlanTier(body?.plan);
    const interval = normalizeBillingInterval(body?.interval);

    if (targetPlan === "free") {
        return NextResponse.json(
            { error: "Checkout is only available for paid plans." },
            { status: 400 },
        );
    }

    const stripe = getStripeClient();
    const subscription = await getOrCreateSubscriptionRecord(user.id);

    // A second Checkout session for a customer who already subscribes creates a
    // second subscription and bills them twice. Plan and interval changes belong
    // in the billing portal, which prorates instead.
    if (
        subscription.stripe_subscription_id &&
        ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
    ) {
        return NextResponse.json(
            {
                error:
                    "You already have an active subscription. Manage or change your plan from the billing portal.",
                code: "SUBSCRIPTION_EXISTS",
            },
            { status: 409 },
        );
    }

    let customerId = subscription.stripe_customer_id;

    if (!customerId) {
        const { data: profile } = await supabaseAdmin
            .from("professors")
            .select("name, email")
            .eq("id", user.id)
            .maybeSingle();

        const customer = await stripe.customers.create(
            {
                email: user.email || profile?.email || undefined,
                name: profile?.name || undefined,
                metadata: { user_id: user.id },
            },
            // Two concurrent checkout attempts would otherwise create two Stripe
            // customers, and whichever wrote second would orphan the first.
            { idempotencyKey: `customer:${user.id}` },
        );

        customerId = customer.id;

        const { error: linkError } = await supabaseAdmin
            .from("professor_subscriptions")
            .update({
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);

        // Previously ignored. If this write fails the customer is unlinked, and
        // the webhook's customer lookup would find nothing — the exact path that
        // let someone pay and receive no access. Metadata on the session below
        // is the backstop, but a failure here still needs to be surfaced.
        if (linkError) {
            logger.error("Failed to link Stripe customer to subscription row", {
                userId: user.id,
                customerId,
                error: linkError,
            });

            return NextResponse.json(
                { error: "Could not start checkout. Please try again." },
                { status: 500 },
            );
        }
    }

    const baseUrl = getAppBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
            {
                price: getStripePriceId(targetPlan as PaidPlanTier, interval),
                quantity: 1,
            },
        ],
        success_url: `${baseUrl}/dashboard/settings?billing=success`,
        cancel_url: `${baseUrl}/dashboard/settings?billing=cancelled`,
        // client_reference_id and metadata both carry the user id so the webhook
        // can resolve the account without depending on the customer lookup.
        client_reference_id: user.id,
        metadata: {
            user_id: user.id,
            target_plan: targetPlan,
            billing_interval: interval,
        },
        subscription_data: {
            metadata: {
                user_id: user.id,
                target_plan: targetPlan,
                billing_interval: interval,
            },
        },
    });

    return NextResponse.json({ url: checkoutSession.url });
}
