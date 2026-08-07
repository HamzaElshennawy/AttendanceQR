import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getAppBaseUrl, getStripeClient, getStripePriceId } from "@/lib/stripe";
import { getOrCreateSubscriptionRecord, normalizePlanTier, type PlanTier } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();
    const targetPlan = normalizePlanTier(plan) as PlanTier;

    if (targetPlan === "free") {
        return NextResponse.json(
            { error: "Checkout is only available for paid plans." },
            { status: 400 },
        );
    }

    const stripe = getStripeClient();
    const subscription = await getOrCreateSubscriptionRecord(user.id);
    let customerId = subscription.stripe_customer_id;

    if (!customerId) {
        const { data: profile } = await supabaseAdmin
            .from("professors")
            .select("name, email")
            .eq("id", user.id)
            .maybeSingle();

        const customer = await stripe.customers.create({
            email: user.email || profile?.email || undefined,
            name: profile?.name || undefined,
            metadata: {
                user_id: user.id,
            },
        });

        customerId = customer.id;

        await supabaseAdmin
            .from("professor_subscriptions")
            .update({
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
    }

    const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
            {
                price: getStripePriceId(targetPlan),
                quantity: 1,
            },
        ],
        success_url: `${getAppBaseUrl()}/dashboard/settings?billing=success`,
        cancel_url: `${getAppBaseUrl()}/dashboard/settings?billing=cancelled`,
        metadata: {
            user_id: user.id,
            target_plan: targetPlan,
        },
        subscription_data: {
            metadata: {
                user_id: user.id,
                target_plan: targetPlan,
            },
        },
    });

    return NextResponse.json({ url: checkoutSession.url });
}
