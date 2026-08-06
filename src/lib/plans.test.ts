import test from "node:test";
import assert from "node:assert/strict";

import {
    PLAN_DEFINITIONS,
    annualSavingMonths,
    formatPrice,
    formatQuota,
    isUpgrade,
    minimumTierForFeature,
    normalizeBillingInterval,
    normalizePlanTier,
    planIncludesFeature,
    resolveEffectivePlan,
    type EffectivePlanInput,
} from "@/lib/plans";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function subscription(
    overrides: Partial<EffectivePlanInput> = {},
): EffectivePlanInput {
    return {
        planTier: "pro",
        status: "active",
        isDisabled: false,
        graceUntil: null,
        pausedUntil: null,
        ...overrides,
    };
}

test("plan matrix gates features at the right tiers", () => {
    assert.equal(planIncludesFeature("free", "exams"), false);
    assert.equal(planIncludesFeature("plus", "exams"), false);
    assert.equal(planIncludesFeature("pro", "exams"), true);

    // Spreadsheet import is the Free -> Plus lever; it must not be free.
    assert.equal(planIncludesFeature("free", "spreadsheet_import"), false);
    assert.equal(planIncludesFeature("plus", "spreadsheet_import"), true);

    assert.equal(planIncludesFeature("free", "team_members"), false);
    assert.equal(planIncludesFeature("plus", "team_members"), true);

    // Coursework is the core loop and stays available on every plan.
    for (const tier of ["free", "plus", "pro"] as const) {
        assert.equal(planIncludesFeature(tier, "coursework"), true);
    }
});

test("minimum tier for a feature drives upgrade copy", () => {
    assert.equal(minimumTierForFeature("exams"), "pro");
    assert.equal(minimumTierForFeature("spreadsheet_import"), "plus");
    assert.equal(minimumTierForFeature("coursework"), "free");
});

test("quotas increase with tier and Pro is genuinely unlimited", () => {
    assert.equal(PLAN_DEFINITIONS.free.quotas.groups, 1);
    assert.equal(PLAN_DEFINITIONS.plus.quotas.groups, 5);
    assert.equal(PLAN_DEFINITIONS.pro.quotas.groups, Infinity);

    // Infinity rather than a 999999 sentinel, so this reads as "Unlimited".
    assert.equal(formatQuota(PLAN_DEFINITIONS.pro.quotas.students), "Unlimited");
    assert.equal(formatQuota(PLAN_DEFINITIONS.free.quotas.students), "50");

    // JSON.stringify turns Infinity into null, which is what the client sees.
    assert.equal(formatQuota(null), "Unlimited");
    assert.equal(JSON.parse(JSON.stringify({ q: Infinity })).q, null);
});

test("annual pricing gives two months free on paid plans", () => {
    assert.equal(annualSavingMonths("plus"), 2);
    assert.equal(annualSavingMonths("pro"), 2);
    assert.equal(annualSavingMonths("free"), 0);

    assert.equal(formatPrice("plus", "month"), "$5/month");
    assert.equal(formatPrice("plus", "year"), "$50/year");
    assert.equal(formatPrice("pro", "year"), "$100/year");
});

test("normalizers reject unknown input", () => {
    assert.equal(normalizePlanTier("enterprise"), "free");
    assert.equal(normalizePlanTier(null), "free");
    assert.equal(normalizePlanTier("pro"), "pro");

    assert.equal(normalizeBillingInterval("weekly"), "month");
    assert.equal(normalizeBillingInterval("year"), "year");
    assert.equal(normalizeBillingInterval(undefined), "month");
});

test("isUpgrade orders the tiers", () => {
    assert.equal(isUpgrade("free", "plus"), true);
    assert.equal(isUpgrade("plus", "pro"), true);
    assert.equal(isUpgrade("pro", "plus"), false);
    assert.equal(isUpgrade("plus", "plus"), false);
});

test("active subscribers get the plan they pay for", () => {
    assert.equal(
        resolveEffectivePlan(subscription({ planTier: "pro" }), NOW).plan.tier,
        "pro",
    );
    assert.equal(
        resolveEffectivePlan(subscription({ planTier: "plus" }), NOW).plan.tier,
        "plus",
    );
    assert.equal(
        resolveEffectivePlan(
            subscription({ planTier: "pro", status: "trialing" }),
            NOW,
        ).plan.tier,
        "pro",
    );
});

test("non-paying statuses fall back to Free", () => {
    for (const status of [
        "free",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
    ] as const) {
        const result = resolveEffectivePlan(
            subscription({ planTier: "pro", status }),
            NOW,
        );

        assert.equal(result.plan.tier, "free", `status ${status} should lapse`);
        assert.equal(result.lapsed, true);
    }
});

test("a failed payment keeps access until the grace window closes", () => {
    const inGrace = resolveEffectivePlan(
        subscription({
            planTier: "pro",
            status: "past_due",
            graceUntil: "2026-06-08T00:00:00.000Z",
        }),
        NOW,
    );

    assert.equal(inGrace.plan.tier, "pro");
    assert.equal(inGrace.lapsed, false);

    const expired = resolveEffectivePlan(
        subscription({
            planTier: "pro",
            status: "past_due",
            graceUntil: "2026-05-25T00:00:00.000Z",
        }),
        NOW,
    );

    assert.equal(expired.plan.tier, "free");
    assert.equal(expired.lapsed, true);
});

test("an explicitly disabled subscription lapses regardless of status", () => {
    const result = resolveEffectivePlan(
        subscription({ planTier: "pro", status: "active", isDisabled: true }),
        NOW,
    );

    assert.equal(result.plan.tier, "free");
    assert.equal(result.lapsed, true);
});

test("a paused subscription does not hand out a free Pro plan", () => {
    // The regression this guards: Stripe reports a paused subscription as
    // "active", so resolving on status alone would grant full Pro to someone
    // who is not being billed, indefinitely.
    const paused = resolveEffectivePlan(
        subscription({
            planTier: "pro",
            status: "active",
            pausedUntil: "2026-09-01T00:00:00.000Z",
        }),
        NOW,
    );

    assert.equal(paused.isPaused, true);
    assert.equal(paused.plan.tier, "free");
    // Not "lapsed" — they are a paying customer taking a break, and the UI
    // distinguishes the two.
    assert.equal(paused.lapsed, false);
});

test("access returns when the pause expires", () => {
    const resumed = resolveEffectivePlan(
        subscription({
            planTier: "pro",
            status: "active",
            pausedUntil: "2026-05-01T00:00:00.000Z",
        }),
        NOW,
    );

    assert.equal(resumed.isPaused, false);
    assert.equal(resumed.plan.tier, "pro");
});
