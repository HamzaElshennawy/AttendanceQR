import { supabaseAdmin } from "@/lib/supabase/admin";

export type PlanTier = "free" | "plus" | "pro";
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
    | "team_members"
    | "rich_reporting"
    | "advanced_exports"
    | "exams";

export interface PlanDefinition {
    tier: PlanTier;
    label: string;
    monthlyPriceLabel: string;
    features: Record<EntitlementFeature, boolean>;
    quotas: {
        groups: number;
        students: number;
        sessionsPerMonth: number;
        teamMembers: number;
    };
}

export interface SubscriptionRecord {
    user_id: string;
    plan_tier: PlanTier;
    status: SubscriptionStatus;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    grace_until: string | null;
    is_disabled: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface UsageSnapshot {
    groups: number;
    students: number;
    sessionsThisMonth: number;
    teamMembers: number;
}

export interface CurrentEntitlements {
    subscription: SubscriptionRecord;
    plan: PlanDefinition;
    usage: UsageSnapshot;
    features: Record<EntitlementFeature, boolean>;
    quotas: PlanDefinition["quotas"];
}

export interface QuotaCheckResult {
    ok: boolean;
    resource: keyof UsageSnapshot;
    current: number;
    requested: number;
    limit: number;
    message: string;
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
    free: {
        tier: "free",
        label: "Free",
        monthlyPriceLabel: "$0",
        features: {
            coursework: true,
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
        monthlyPriceLabel: "$29/month",
        features: {
            coursework: true,
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
        monthlyPriceLabel: "$99/month",
        features: {
            coursework: true,
            team_members: true,
            rich_reporting: true,
            advanced_exports: true,
            exams: true,
        },
        quotas: {
            groups: 999999,
            students: 999999,
            sessionsPerMonth: 999999,
            teamMembers: 999999,
        },
    },
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
    "active",
    "trialing",
    "past_due",
]);

function defaultSubscription(userId: string): SubscriptionRecord {
    return {
        user_id: userId,
        plan_tier: "free",
        status: "free",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        grace_until: null,
        is_disabled: false,
    };
}

export function normalizePlanTier(value: unknown): PlanTier {
    return value === "plus" || value === "pro" ? value : "free";
}

export function planIncludesFeature(
    plan: PlanTier,
    feature: EntitlementFeature,
) {
    return PLAN_DEFINITIONS[plan].features[feature];
}

export async function getOrCreateSubscriptionRecord(userId: string) {
    const { data, error } = await supabaseAdmin
        .from("professor_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (data) {
        return data as SubscriptionRecord;
    }

    const baseline = defaultSubscription(userId);
    const { data: created, error: createError } = await supabaseAdmin
        .from("professor_subscriptions")
        .insert(baseline)
        .select("*")
        .single();

    if (createError || !created) {
        throw createError ?? new Error("Failed to create subscription record.");
    }

    return created as SubscriptionRecord;
}

export async function getUsageSnapshot(userId: string): Promise<UsageSnapshot> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [{ data: groups }] = await Promise.all([
        supabaseAdmin
            .from("groups")
            .select("id")
            .eq("professor_id", userId),
    ]);

    const groupIds = (groups || []).map((group) => group.id);

    const [studentsResult, sessionsResult, membershipsResult] = await Promise.all([
        groupIds.length
            ? supabaseAdmin
                  .from("students")
                  .select("id", { count: "exact", head: true })
                  .in("group_id", groupIds)
            : Promise.resolve({ count: 0 } as { count: number | null }),
        groupIds.length
            ? supabaseAdmin
                  .from("sessions")
                  .select("id", { count: "exact", head: true })
                  .in("group_id", groupIds)
                  .gte("started_at", monthStart.toISOString())
            : Promise.resolve({ count: 0 } as { count: number | null }),
        groupIds.length
            ? supabaseAdmin
                  .from("group_memberships")
                  .select("professor_id", { count: "exact", head: true })
                  .in("group_id", groupIds)
            : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);

    return {
        groups: groupIds.length,
        students: studentsResult.count || 0,
        sessionsThisMonth: sessionsResult.count || 0,
        teamMembers: membershipsResult.count || 0,
    };
}

export async function getCurrentEntitlements(userId: string): Promise<CurrentEntitlements> {
    const subscription = await getOrCreateSubscriptionRecord(userId);
    const planTier = normalizePlanTier(subscription.plan_tier);
    const usage = await getUsageSnapshot(userId);
    const plan = PLAN_DEFINITIONS[planTier];

    const now = Date.now();
    const isDisabled =
        subscription.is_disabled ||
        (subscription.grace_until
            ? new Date(subscription.grace_until).getTime() < now
            : false);

    const effectivePlan =
        isDisabled || !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
            ? PLAN_DEFINITIONS.free
            : plan;

    return {
        subscription: {
            ...subscription,
            plan_tier: effectivePlan.tier,
        },
        plan: effectivePlan,
        usage,
        features: effectivePlan.features,
        quotas: effectivePlan.quotas,
    };
}

export async function requireFeature(userId: string, feature: EntitlementFeature) {
    const entitlements = await getCurrentEntitlements(userId);
    return {
        ok: entitlements.features[feature],
        entitlements,
        message: entitlements.features[feature]
            ? ""
            : `${PLAN_DEFINITIONS.plus.features[feature] || PLAN_DEFINITIONS.pro.features[feature] ? "Upgrade your plan" : "Your current plan"} is required to use this feature.`,
    };
}

export async function checkQuota(
    userId: string,
    resource: keyof UsageSnapshot,
    requestedDelta = 1,
): Promise<QuotaCheckResult> {
    const entitlements = await getCurrentEntitlements(userId);
    const limitMap: Record<keyof UsageSnapshot, number> = {
        groups: entitlements.quotas.groups,
        students: entitlements.quotas.students,
        sessionsThisMonth: entitlements.quotas.sessionsPerMonth,
        teamMembers: entitlements.quotas.teamMembers,
    };
    const current = entitlements.usage[resource];
    const limit = limitMap[resource];
    const ok = current + requestedDelta <= limit;

    return {
        ok,
        resource,
        current,
        requested: requestedDelta,
        limit,
        message: ok
            ? ""
            : `Your ${entitlements.plan.label} plan allows ${limit} ${resource}. Upgrade to continue.`,
    };
}
