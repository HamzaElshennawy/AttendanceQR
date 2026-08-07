import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getAppBaseUrl, getStripeClient } from "@/lib/stripe";
import { getOrCreateSubscriptionRecord } from "@/lib/subscriptions";

export async function POST() {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getOrCreateSubscriptionRecord(user.id);
    if (!subscription.stripe_customer_id) {
        return NextResponse.json(
            { error: "No Stripe customer exists for this account yet." },
            { status: 400 },
        );
    }

    try {
        const stripe = getStripeClient();
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${getAppBaseUrl()}/dashboard/settings`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        // A missing STRIPE_SECRET_KEY, an unconfigured portal, or a network
        // blip would otherwise surface as a bare 500 with no body for the
        // client to read.
        logger.error("Failed to create Stripe billing portal session", {
            userId: user.id,
            error,
        });

        return NextResponse.json(
            { error: "Could not open the billing portal. Please try again." },
            { status: 500 },
        );
    }
}
