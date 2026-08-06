import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getStripeClient, getStripePriceId } from "@/lib/stripe";
import { getCurrentEntitlements } from "@/lib/subscriptions";
import { normalizePlanTier, type PaidPlanTier } from "@/lib/plans";
import {
    canClaimRetentionOffer,
    isRetentionReason,
    offerForReason,
    pauseResumesAt,
    toStripeCancellationFeedback,
    type RetentionOffer,
    type RetentionReason,
} from "@/lib/retention";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RetentionOutcome =
    | "retained_annual"
    | "retained_downgrade"
    | "retained_pause"
    | "retained_feedback"
    | "cancelled";

async function recordEvent(entry: {
    userId: string;
    reason: RetentionReason;
    offerShown: string | null;
    offerAccepted: boolean;
    outcome: RetentionOutcome | null;
}) {
    const { error } = await supabaseAdmin.from("retention_events").insert({
        user_id: entry.userId,
        reason: entry.reason,
        offer_shown: entry.offerShown,
        offer_accepted: entry.offerAccepted,
        outcome: entry.outcome,
    });

    if (error) {
        // The funnel record is analytics, not correctness — never fail the
        // customer's cancellation because we could not log it.
        logger.error("Failed to record retention event", {
            userId: entry.userId,
            error,
        });
    }
}

export async function POST(request: Request) {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const reason = body?.reason;

    if (!isRetentionReason(reason)) {
        return NextResponse.json(
            { error: "A valid cancellation reason is required." },
            { status: 400 },
        );
    }

    const entitlements = await getCurrentEntitlements(user.id);
    const { subscription } = entitlements;

    const tier = normalizePlanTier(subscription.plan_tier);
    const interval = subscription.billing_interval;
    const canClaim = canClaimRetentionOffer(subscription.retention_offer_claimed_at);

    const offer = offerForReason({ reason, tier, interval, canClaim });

    // --- Step one: show the offer --------------------------------------------
    if (action === "offer") {
        await recordEvent({
            userId: user.id,
            reason,
            offerShown: offer.kind,
            offerAccepted: false,
            outcome: null,
        });

        return NextResponse.json({ offer, can_claim: canClaim });
    }

    // --- Feature request capture ---------------------------------------------
    // Handled before the subscription check: someone on a free trial or an
    // already-cancelled plan can still tell us what was missing.
    if (action === "accept" && offer.kind === "feedback") {
        const message = String(body?.message || "").trim();

        if (!message) {
            return NextResponse.json(
                { error: "Please tell us what was missing." },
                { status: 400 },
            );
        }

        const { error } = await supabaseAdmin.from("feedback_entries").insert({
            professor_id: user.id,
            category: "feature",
            rating: null,
            severity: null,
            message,
            attachments: [],
        });

        if (error) {
            logger.error("Failed to store retention feedback", {
                userId: user.id,
                error,
            });
            return NextResponse.json(
                { error: "Could not send your feedback. Please try again." },
                { status: 500 },
            );
        }

        await recordEvent({
            userId: user.id,
            reason,
            offerShown: offer.kind,
            offerAccepted: true,
            outcome: "retained_feedback",
        });

        return NextResponse.json({
            ok: true,
            outcome: "retained_feedback",
            message: "Thanks — that's gone straight to the team.",
        });
    }

    if (!subscription.stripe_subscription_id) {
        return NextResponse.json(
            { error: "There is no active subscription to change." },
            { status: 400 },
        );
    }

    const stripe = getStripeClient();
    const subscriptionId = subscription.stripe_subscription_id;

    // --- Step two: they declined, cancel at period end ------------------------
    if (action === "decline" || action === "cancel") {
        await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true,
            cancellation_details: {
                feedback: toStripeCancellationFeedback(reason),
                comment: body?.message ? String(body.message).slice(0, 500) : undefined,
            },
        });

        await supabaseAdmin
            .from("professor_subscriptions")
            .update({
                cancel_at_period_end: true,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);

        await recordEvent({
            userId: user.id,
            reason,
            offerShown: offer.kind,
            offerAccepted: false,
            outcome: "cancelled",
        });

        return NextResponse.json({
            ok: true,
            outcome: "cancelled",
            message:
                "Your plan is cancelled and stays active until the end of the current billing period.",
        });
    }

    if (action !== "accept") {
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    // --- Step two: they accepted the offer ------------------------------------
    if (!canClaim || offer.kind === "none") {
        return NextResponse.json(
            { error: "No retention offer is available on this account." },
            { status: 409 },
        );
    }

    let outcome: RetentionOutcome;
    let message: string;

    try {
        outcome = await applyOffer({ subscriptionId, offer });
        message = confirmationFor(outcome);
    } catch (error) {
        logger.error("Failed to apply retention offer", {
            userId: user.id,
            offer: offer.kind,
            error,
        });

        return NextResponse.json(
            { error: "Could not apply that change. Please try again." },
            { status: 500 },
        );
    }

    // Claim is stamped only for billing-affecting offers, and only after Stripe
    // has accepted the change.
    await supabaseAdmin
        .from("professor_subscriptions")
        .update({
            retention_offer_claimed_at: new Date().toISOString(),
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

    await recordEvent({
        userId: user.id,
        reason,
        offerShown: offer.kind,
        offerAccepted: true,
        outcome,
    });

    return NextResponse.json({ ok: true, outcome, message });
}

async function applyOffer(args: {
    subscriptionId: string;
    offer: RetentionOffer;
}): Promise<RetentionOutcome> {
    const stripe = getStripeClient();
    const { subscriptionId, offer } = args;

    if (offer.kind === "pause") {
        await stripe.subscriptions.update(subscriptionId, {
            pause_collection: {
                // "void" stops billing and voids invoices raised during the
                // pause, rather than accumulating a bill to settle on return.
                behavior: "void",
                resumes_at: pauseResumesAt(offer.pauseMonths ?? 3),
            },
        });

        return "retained_pause";
    }

    // Both remaining offers swap the price on the existing subscription item,
    // which prorates, rather than cancelling and re-subscribing.
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    const itemId = current.items.data[0]?.id;

    if (!itemId) {
        throw new Error(`Subscription ${subscriptionId} has no items to update.`);
    }

    const targetTier = (offer.targetTier ?? "plus") as PaidPlanTier;
    const targetInterval = offer.targetInterval ?? "month";

    await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: getStripePriceId(targetTier, targetInterval) }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
    });

    return offer.kind === "annual_switch"
        ? "retained_annual"
        : "retained_downgrade";
}

function confirmationFor(outcome: RetentionOutcome) {
    switch (outcome) {
        case "retained_annual":
            return "You're on the annual plan now. The difference has been prorated against your current period.";
        case "retained_downgrade":
            return "Your plan has been changed. The difference has been prorated against your current period.";
        case "retained_pause":
            return "Your plan is paused. We won't bill you again until it resumes, and your data stays exactly as it is.";
        default:
            return "Done.";
    }
}
