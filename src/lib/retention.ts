/**
 * Cancellation retention.
 *
 * A customer who clicks cancel is asked why first, and offered the remedy that
 * actually addresses their reason rather than a blanket discount.
 *
 * The seasonal pause matters most for this product specifically: academic
 * software has a predictable summer churn cliff, and an instructor who cancels
 * in June is lost for the autumn term. Pausing keeps their groups, students,
 * and coursework history intact and brings them back automatically.
 *
 * Pure logic only — no Stripe or database calls, so it is directly testable.
 */

import {
    PLAN_DEFINITIONS,
    annualSavingMonths,
    formatPrice,
    type BillingInterval,
    type PlanTier,
} from "@/lib/plans";

export const RETENTION_REASONS = [
    "too_expensive",
    "not_using",
    "term_ended",
    "missing_feature",
    "other",
] as const;

export type RetentionReason = (typeof RETENTION_REASONS)[number];

export type RetentionOfferKind =
    | "annual_switch"
    | "downgrade"
    | "pause"
    | "feedback"
    | "none";

/** Longest pause we will grant. Beyond this a pause is just a free plan. */
export const MAX_PAUSE_MONTHS = 3;

/** A retention offer can only be claimed once per rolling year. */
export const RETENTION_COOLDOWN_MONTHS = 12;

export interface RetentionOffer {
    kind: RetentionOfferKind;
    headline: string;
    body: string;
    acceptLabel: string;
    /** Target tier for a downgrade offer. */
    targetTier?: PlanTier;
    /** Target interval for an annual switch. */
    targetInterval?: BillingInterval;
    pauseMonths?: number;
}

export function isRetentionReason(value: unknown): value is RetentionReason {
    return RETENTION_REASONS.includes(value as RetentionReason);
}

/** Maps our reasons onto Stripe's fixed cancellation feedback enum. */
export function toStripeCancellationFeedback(
    reason: RetentionReason,
):
    | "too_expensive"
    | "unused"
    | "missing_features"
    | "other" {
    switch (reason) {
        case "too_expensive":
            return "too_expensive";
        case "not_using":
            return "unused";
        case "missing_feature":
            return "missing_features";
        default:
            return "other";
    }
}

/**
 * Whether a billing-affecting offer may be made.
 *
 * Without this a customer could cancel, accept a pause or downgrade, and repeat
 * every month indefinitely. Feedback capture is exempt — it costs nothing.
 */
export function canClaimRetentionOffer(
    retentionOfferClaimedAt: string | null,
    now: Date = new Date(),
): boolean {
    if (!retentionOfferClaimedAt) {
        return true;
    }

    const claimedAt = new Date(retentionOfferClaimedAt);

    if (Number.isNaN(claimedAt.getTime())) {
        return true;
    }

    const cooldownEnds = new Date(claimedAt);
    cooldownEnds.setMonth(cooldownEnds.getMonth() + RETENTION_COOLDOWN_MONTHS);

    return now.getTime() >= cooldownEnds.getTime();
}

export function offerForReason(args: {
    reason: RetentionReason;
    tier: PlanTier;
    interval: BillingInterval;
    canClaim: boolean;
}): RetentionOffer {
    const { reason, tier, interval, canClaim } = args;

    // Feedback capture is always available; it changes no billing state.
    if (reason === "missing_feature") {
        return {
            kind: "feedback",
            headline: "Tell us what's missing",
            body: "Send it straight to the team. We read every one, and we'll follow up if we build it.",
            acceptLabel: "Send feedback",
        };
    }

    if (!canClaim) {
        return {
            kind: "none",
            headline: "Sorry to see you go",
            body: "Your plan stays active until the end of the current billing period, and your data is kept.",
            acceptLabel: "Continue",
        };
    }

    if (reason === "term_ended") {
        return {
            kind: "pause",
            headline: `Pause for up to ${MAX_PAUSE_MONTHS} months instead`,
            body: "We'll stop billing you now and pick up where you left off next term. Your groups, students, and coursework history stay exactly as they are.",
            acceptLabel: "Pause my plan",
            pauseMonths: MAX_PAUSE_MONTHS,
        };
    }

    if (reason === "too_expensive") {
        // Annual is the only discount on offer, so it is the lever here — but
        // it is a larger charge up front, which will not suit everyone.
        if (interval === "month" && tier !== "free") {
            const saving = annualSavingMonths(tier);

            return {
                kind: "annual_switch",
                headline: `Switch to annual and get ${saving} months free`,
                body: `${PLAN_DEFINITIONS[tier].label} annual is ${formatPrice(tier, "year")} instead of ${formatPrice(tier, "month")} — the same plan for ${saving} fewer months of cost.`,
                acceptLabel: "Switch to annual",
                targetTier: tier,
                targetInterval: "year",
            };
        }

        if (tier === "pro") {
            return {
                kind: "downgrade",
                headline: "Move to Plus instead",
                body: `Plus keeps team roles, reporting, exports, and spreadsheet imports at ${formatPrice("plus", interval)}. You would lose the exams engine.`,
                acceptLabel: "Switch to Plus",
                targetTier: "plus",
                targetInterval: interval,
            };
        }

        return {
            kind: "pause",
            headline: `Pause for up to ${MAX_PAUSE_MONTHS} months instead`,
            body: "We'll stop billing you now and keep everything in place until you're ready to come back.",
            acceptLabel: "Pause my plan",
            pauseMonths: MAX_PAUSE_MONTHS,
        };
    }

    // not_using / other
    if (tier === "pro") {
        return {
            kind: "downgrade",
            headline: "Move to Plus instead",
            body: `A smaller plan at ${formatPrice("plus", interval)} may fit your teaching load better. You keep everything except the exams engine.`,
            acceptLabel: "Switch to Plus",
            targetTier: "plus",
            targetInterval: interval,
        };
    }

    return {
        kind: "pause",
        headline: `Pause for up to ${MAX_PAUSE_MONTHS} months instead`,
        body: "Stop billing now and keep your data. Resume whenever your next term starts.",
        acceptLabel: "Pause my plan",
        pauseMonths: MAX_PAUSE_MONTHS,
    };
}

/** Unix seconds at which a pause of `months` should resume. */
export function pauseResumesAt(months: number, now: Date = new Date()): number {
    const capped = Math.min(Math.max(1, months), MAX_PAUSE_MONTHS);
    const resumes = new Date(now);
    resumes.setMonth(resumes.getMonth() + capped);

    return Math.floor(resumes.getTime() / 1000);
}
