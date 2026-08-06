/**
 * Plan and entitlement definitions.
 *
 * Deliberately free of any database or Stripe import so client components can
 * render pricing without pulling the service-role client into the browser
 * bundle. Everything that touches the database lives in subscriptions.ts.
 */

export type PlanTier = "free" | "plus" | "pro";
export type PaidPlanTier = Exclude<PlanTier, "free">;
export type BillingInterval = "month" | "year";

export type SubscriptionStatus =
    | "free"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired";

export type EntitlementFeature =
    | "coursework"
    | "spreadsheet_import"
    | "team_members"
    | "rich_reporting"
    | "advanced_exports"
    | "exams";

export interface PlanPricing {
    /** Whole currency units per interval. */
    month: number;
    year: number;
}

export interface PlanDefinition {
    tier: PlanTier;
    label: string;
    pricing: PlanPricing;
    features: Record<EntitlementFeature, boolean>;
    quotas: {
        groups: number;
        students: number;
        sessionsPerMonth: number;
        teamMembers: number;
    };
}

/**
 * Annual is priced at ten months for twelve. The academic year is the real
 * billing cycle for this product — an instructor committing for a year is
 * committing for two semesters.
 */
export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
    free: {
        tier: "free",
        label: "Free",
        pricing: { month: 0, year: 0 },
        features: {
            coursework: true,
            spreadsheet_import: false,
            team_members: false,
            rich_reporting: false,
            advanced_exports: false,
            exams: false,
        },
        quotas: {
            groups: 1,
            students: 50,
            sessionsPerMonth: 10,
            teamMembers: 0,
        },
    },
    plus: {
        tier: "plus",
        label: "Plus",
        pricing: { month: 5, year: 50 },
        features: {
            coursework: true,
            spreadsheet_import: true,
            team_members: true,
            rich_reporting: true,
            advanced_exports: true,
            exams: false,
        },
        quotas: {
            groups: 5,
            students: 500,
            sessionsPerMonth: 200,
            teamMembers: 5,
        },
    },
    pro: {
        tier: "pro",
        label: "Pro",
        pricing: { month: 10, year: 100 },
        features: {
            coursework: true,
            spreadsheet_import: true,
            team_members: true,
            rich_reporting: true,
            advanced_exports: true,
            exams: true,
        },
        // Infinity rather than a 999999 sentinel, so "unlimited" is literally
        // true and quota messages can say so instead of quoting a fake number.
        quotas: {
            groups: Infinity,
            students: Infinity,
            sessionsPerMonth: Infinity,
            teamMembers: Infinity,
        },
    },
};

export const PLAN_ORDER: PlanTier[] = ["free", "plus", "pro"];

/** Statuses under which Stripe considers the customer to be in good standing. */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
    "active",
    "trialing",
    // Retained deliberately: a failed payment starts a dunning window rather
    // than an immediate cutoff. The window itself is enforced by grace_until.
    "past_due",
]);

export interface EffectivePlanInput {
    planTier: PlanTier;
    status: SubscriptionStatus;
    isDisabled: boolean;
    graceUntil: string | null;
    pausedUntil: string | null;
}

export interface EffectivePlanResult {
    plan: PlanDefinition;
    isPaused: boolean;
    lapsed: boolean;
}

/**
 * Resolves what a subscriber is actually entitled to right now.
 *
 * Pure and separated from the database layer because this is the function that
 * decides whether anyone pays for anything — it needs to be testable directly,
 * without mocking Supabase. The previous version of this logic was commented
 * out and replaced with a hardcoded Pro return, which no test would have caught
 * because the only coverage asserted against the constants rather than against
 * resolution.
 */
export function resolveEffectivePlan(
    input: EffectivePlanInput,
    now: Date = new Date(),
): EffectivePlanResult {
    const subscribedPlan = PLAN_DEFINITIONS[normalizePlanTier(input.planTier)];
    const timestamp = now.getTime();

    // Stripe reports a paused subscription as "active", so pausing has to be
    // detected from our own column or it would grant an indefinite free plan.
    const isPaused = input.pausedUntil
        ? new Date(input.pausedUntil).getTime() > timestamp
        : false;

    const graceExpired = input.graceUntil
        ? new Date(input.graceUntil).getTime() < timestamp
        : false;

    const lapsed =
        input.isDisabled ||
        graceExpired ||
        !ACTIVE_SUBSCRIPTION_STATUSES.has(input.status);

    return {
        plan: isPaused || lapsed ? PLAN_DEFINITIONS.free : subscribedPlan,
        isPaused,
        lapsed,
    };
}

export function normalizePlanTier(value: unknown): PlanTier {
    return value === "plus" || value === "pro" ? value : "free";
}

export function normalizeBillingInterval(value: unknown): BillingInterval {
    return value === "year" ? "year" : "month";
}

export function planIncludesFeature(
    plan: PlanTier,
    feature: EntitlementFeature,
) {
    return PLAN_DEFINITIONS[plan].features[feature];
}

/** Lowest tier that includes a feature, for "Upgrade to X" copy. */
export function minimumTierForFeature(
    feature: EntitlementFeature,
): PlanTier | null {
    return PLAN_ORDER.find((tier) => PLAN_DEFINITIONS[tier].features[feature]) ?? null;
}

export function isUpgrade(from: PlanTier, to: PlanTier) {
    return PLAN_ORDER.indexOf(to) > PLAN_ORDER.indexOf(from);
}

export function formatPrice(tier: PlanTier, interval: BillingInterval) {
    const amount = PLAN_DEFINITIONS[tier].pricing[interval];
    return `$${amount}${interval === "year" ? "/year" : "/month"}`;
}

/**
 * Accepts null because JSON.stringify turns Infinity into null — an unlimited
 * quota arrives at the client as null, not as a number.
 */
export function formatQuota(limit: number | null | undefined) {
    return typeof limit === "number" && Number.isFinite(limit)
        ? String(limit)
        : "Unlimited";
}

/** Months saved per year by paying annually, for the pricing toggle. */
export function annualSavingMonths(tier: PlanTier) {
    const { month, year } = PLAN_DEFINITIONS[tier].pricing;

    if (month <= 0 || year <= 0) {
        return 0;
    }

    return Math.max(0, Math.round((month * 12 - year) / month));
}
