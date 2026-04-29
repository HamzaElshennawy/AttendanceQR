import test from "node:test";
import assert from "node:assert/strict";

test("accepts only exact active token", async () => {
    const { isCurrentSessionTokenValid } = await import("@/lib/attendance-security");
    assert.equal(
        isCurrentSessionTokenValid({
            currentToken: "abc",
            providedToken: "abc",
            tokenExpiresAt: "2099-01-01T00:00:00.000Z",
            now: new Date("2026-01-01T00:00:00.000Z"),
        }),
        true,
    );

    assert.equal(
        isCurrentSessionTokenValid({
            currentToken: "abc",
            providedToken: "xyz",
            tokenExpiresAt: "2099-01-01T00:00:00.000Z",
            now: new Date("2026-01-01T00:00:00.000Z"),
        }),
        false,
    );

    assert.equal(
        isCurrentSessionTokenValid({
            currentToken: "abc",
            providedToken: "abc",
            tokenExpiresAt: "2025-01-01T00:00:00.000Z",
            now: new Date("2026-01-01T00:00:00.000Z"),
        }),
        false,
    );
});

test("plan definitions gate exam access correctly", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const { PLAN_DEFINITIONS, planIncludesFeature } = await import("@/lib/subscriptions");
    assert.equal(planIncludesFeature("free", "exams"), false);
    assert.equal(planIncludesFeature("plus", "exams"), false);
    assert.equal(planIncludesFeature("pro", "exams"), true);
    assert.equal(PLAN_DEFINITIONS.free.quotas.groups, 1);
});
