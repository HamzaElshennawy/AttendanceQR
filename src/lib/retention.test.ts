import test from "node:test";
import assert from "node:assert/strict";

import {
    MAX_PAUSE_MONTHS,
    canClaimRetentionOffer,
    isRetentionReason,
    offerForReason,
    pauseResumesAt,
    toStripeCancellationFeedback,
} from "@/lib/retention";

const NOW = new Date("2026-06-01T00:00:00.000Z");

test("only known reasons are accepted", () => {
    assert.equal(isRetentionReason("too_expensive"), true);
    assert.equal(isRetentionReason("term_ended"), true);
    assert.equal(isRetentionReason("because"), false);
    assert.equal(isRetentionReason(null), false);
});

test("reasons map onto Stripe's cancellation feedback enum", () => {
    assert.equal(toStripeCancellationFeedback("too_expensive"), "too_expensive");
    assert.equal(toStripeCancellationFeedback("not_using"), "unused");
    assert.equal(
        toStripeCancellationFeedback("missing_feature"),
        "missing_features",
    );
    assert.equal(toStripeCancellationFeedback("term_ended"), "other");
    assert.equal(toStripeCancellationFeedback("other"), "other");
});

test("a monthly subscriber who says it costs too much is offered annual", () => {
    const offer = offerForReason({
        reason: "too_expensive",
        tier: "pro",
        interval: "month",
        canClaim: true,
    });

    assert.equal(offer.kind, "annual_switch");
    assert.equal(offer.targetInterval, "year");
    assert.equal(offer.targetTier, "pro");
    assert.match(offer.headline, /2 months free/);
});

test("an annual Pro subscriber who says it costs too much is offered Plus", () => {
    // Annual is already the discount, so there is nothing cheaper to offer at
    // the same tier — step down instead.
    const offer = offerForReason({
        reason: "too_expensive",
        tier: "pro",
        interval: "year",
        canClaim: true,
    });

    assert.equal(offer.kind, "downgrade");
    assert.equal(offer.targetTier, "plus");
    assert.equal(offer.targetInterval, "year");
});

test("end of term is offered a pause, not a discount", () => {
    // The highest-value lever for academic software: an instructor who cancels
    // in June is otherwise lost for the autumn term.
    const offer = offerForReason({
        reason: "term_ended",
        tier: "plus",
        interval: "month",
        canClaim: true,
    });

    assert.equal(offer.kind, "pause");
    assert.equal(offer.pauseMonths, MAX_PAUSE_MONTHS);
});

test("underuse steps Pro down to Plus and pauses Plus", () => {
    assert.equal(
        offerForReason({
            reason: "not_using",
            tier: "pro",
            interval: "month",
            canClaim: true,
        }).kind,
        "downgrade",
    );

    assert.equal(
        offerForReason({
            reason: "not_using",
            tier: "plus",
            interval: "month",
            canClaim: true,
        }).kind,
        "pause",
    );
});

test("a missing feature is captured as feedback even without an offer available", () => {
    // Exempt from the cooldown: collecting it costs nothing and changes no
    // billing state.
    const offer = offerForReason({
        reason: "missing_feature",
        tier: "pro",
        interval: "month",
        canClaim: false,
    });

    assert.equal(offer.kind, "feedback");
});

test("no billing offer is made when the cooldown is still running", () => {
    for (const reason of ["too_expensive", "not_using", "term_ended"] as const) {
        const offer = offerForReason({
            reason,
            tier: "pro",
            interval: "month",
            canClaim: false,
        });

        assert.equal(offer.kind, "none", `${reason} should not offer anything`);
    }
});

test("retention offers are limited to one per year", () => {
    // Never claimed.
    assert.equal(canClaimRetentionOffer(null, NOW), true);

    // Claimed last month — cancel-and-claim-again is exactly what this blocks.
    assert.equal(
        canClaimRetentionOffer("2026-05-01T00:00:00.000Z", NOW),
        false,
    );

    // Claimed eleven months ago, still inside the window.
    assert.equal(
        canClaimRetentionOffer("2025-08-01T00:00:00.000Z", NOW),
        false,
    );

    // Claimed over a year ago.
    assert.equal(
        canClaimRetentionOffer("2025-05-01T00:00:00.000Z", NOW),
        true,
    );

    // Exactly on the boundary.
    assert.equal(
        canClaimRetentionOffer("2025-06-01T00:00:00.000Z", NOW),
        true,
    );

    // Unparseable values must not lock a customer out of an offer.
    assert.equal(canClaimRetentionOffer("not-a-date", NOW), true);
});

test("pause length is clamped to the maximum", () => {
    const threeMonths = pauseResumesAt(3, NOW);
    assert.equal(
        new Date(threeMonths * 1000).toISOString(),
        "2026-09-01T00:00:00.000Z",
    );

    // A caller asking for a year gets the cap, so a pause can never become a
    // permanent free plan.
    assert.equal(pauseResumesAt(12, NOW), threeMonths);

    // And it always moves forward.
    assert.ok(pauseResumesAt(0, NOW) > Math.floor(NOW.getTime() / 1000));
});
