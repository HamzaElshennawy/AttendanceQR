import { supabaseAdmin } from "@/lib/supabase/admin";
import {
    PLAN_DEFINITIONS,
    formatQuota,
    minimumTierForFeature,
    normalizePlanTier,
    resolveEffectivePlan,
    type BillingInterval,
    type EntitlementFeature,
    type PlanDefinition,
    type PlanTier,
    type SubscriptionStatus,
} from "@/lib/plans";

// Re-exported so existing imports from this module keep working.
export {
    ACTIVE_SUBSCRIPTION_STATUSES,
    PLAN_DEFINITIONS,
    normalizeBillingInterval,
    normalizePlanTier,
    planIncludesFeature,
    type BillingInterval,
    type EntitlementFeature,
    type PlanDefinition,
    type PlanTier,
    type SubscriptionStatus,
} from "@/lib/plans";

export interface SubscriptionRecord {
    user_id: string;
    plan_tier: PlanTier;
    status: SubscriptionStatus;
    billing_interval: BillingInterval;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    grace_until: string | null;
    is_disabled: boolean;
    paused_until: string | null;
    retention_offer_claimed_at: string | null;
    last_stripe_event_at: string | null;
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
    /** The plan actually in force, after pause/grace/status resolution. */
    plan: PlanDefinition;
    /** What the customer pays for, which may differ from `plan` while lapsed. */
    subscribedPlan: PlanDefinition;
    usage: UsageSnapshot;
    features: Record<EntitlementFeature, boolean>;
    quotas: PlanDefinition["quotas"];
    isPaused: boolean;
    pausedUntil: string | null;
}

export interface QuotaCheckResult {
    ok: boolean;
    resource: keyof UsageSnapshot;
    current: number;
    requested: number;
    limit: number;
    message: string;
}

function defaultSubscription(userId: string): SubscriptionRecord {
    return {
        user_id: userId,
        plan_tier: "free",
        status: "free",
        billing_interval: "month",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        grace_until: null,
        is_disabled: false,
        paused_until: null,
        retention_offer_claimed_at: null,
        last_stripe_event_at: null,
    };
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

    // upsert rather than insert: registration and a first billing call can race,
    // and the unique index on user_id would turn that into a hard 500.
    const { data: created, error: createError } = await supabaseAdmin
        .from("professor_subscriptions")
        .upsert(defaultSubscription(userId), { onConflict: "user_id" })
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

    const { data: groups } = await supabaseAdmin
        .from("groups")
        .select("id")
        .eq("professor_id", userId);

    const groupIds = (groups || []).map((group) => group.id);

    if (!groupIds.length) {
        return { groups: 0, students: 0, sessionsThisMonth: 0, teamMembers: 0 };
    }

    const [studentsResult, sessionsResult, membershipsResult] = await Promise.all([
        supabaseAdmin
            .from("students")
            .select("id", { count: "exact", head: true })
            .in("group_id", groupIds),
        supabaseAdmin
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .in("group_id", groupIds)
            .gte("started_at", monthStart.toISOString()),
        supabaseAdmin
            .from("group_memberships")
            .select("professor_id", { count: "exact", head: true })
            .in("group_id", groupIds),
    ]);

    return {
        groups: groupIds.length,
        students: studentsResult.count || 0,
        sessionsThisMonth: sessionsResult.count || 0,
        teamMembers: membershipsResult.count || 0,
    };
}

export async function getCurrentEntitlements(
    userId: string,
): Promise<CurrentEntitlements> {
    const subscription = await getOrCreateSubscriptionRecord(userId);
    const usage = await getUsageSnapshot(userId);

    const subscribedPlan =
        PLAN_DEFINITIONS[normalizePlanTier(subscription.plan_tier)];

    // A paused customer drops to Free entitlements: they are not being billed
    // and, by their own account, not teaching this term. Nothing is deleted, so
    // their groups and history stay readable — Free quotas only gate creating
    // new things, and everything returns on resume.
    const { plan: effectivePlan, isPaused } = resolveEffectivePlan({
        planTier: subscription.plan_tier,
        status: subscription.status,
        isDisabled: subscription.is_disabled,
        graceUntil: subscription.grace_until,
        pausedUntil: subscription.paused_until,
    });

    return {
        subscription,
        plan: effectivePlan,
        subscribedPlan,
        usage,
        features: effectivePlan.features,
        quotas: effectivePlan.quotas,
        isPaused,
        pausedUntil: isPaused ? subscription.paused_until : null,
    };
}

export async function requireFeature(
    userId: string,
    feature: EntitlementFeature,
) {
    const entitlements = await getCurrentEntitlements(userId);
    const ok = entitlements.features[feature];

    if (ok) {
        return { ok, entitlements, message: "" };
    }

    const required = minimumTierForFeature(feature);
    const message = required
        ? `Upgrade to ${PLAN_DEFINITIONS[required].label} to use this feature.`
        : "This feature is not available on your current plan.";

    return { ok, entitlements, message };
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

    const resourceLabel: Record<keyof UsageSnapshot, string> = {
        groups: "groups",
        students: "students",
        sessionsThisMonth: "sessions per month",
        teamMembers: "team members",
    };

    return {
        ok,
        resource,
        current,
        requested: requestedDelta,
        limit,
        message: ok
            ? ""
            : `Your ${entitlements.plan.label} plan allows ${formatQuota(limit)} ${resourceLabel[resource]}. Upgrade to continue.`,
    };
}
