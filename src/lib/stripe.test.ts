import test from "node:test";
import assert from "node:assert/strict";

import { resolvePriceId, subscriptionIdFromInvoice } from "@/lib/stripe";

// Read at call time, not import time, so setting them here is enough.
process.env.STRIPE_PLUS_MONTHLY_PRICE_ID = "price_plus_monthly";
process.env.STRIPE_PLUS_ANNUAL_PRICE_ID = "price_plus_annual";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_monthly";
process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_pro_annual";

test("every configured price resolves to its tier and interval", () => {
    assert.deepEqual(resolvePriceId("price_plus_monthly"), {
        tier: "plus",
        interval: "month",
    });
    assert.deepEqual(resolvePriceId("price_plus_annual"), {
        tier: "plus",
        interval: "year",
    });
    assert.deepEqual(resolvePriceId("price_pro_monthly"), {
        tier: "pro",
        interval: "month",
    });

    // The regression this guards: the old implementation compared against two
    // env vars and defaulted anything else to "free", so introducing annual
    // prices would have silently downgraded every annual subscriber.
    assert.deepEqual(resolvePriceId("price_pro_annual"), {
        tier: "pro",
        interval: "year",
    });
});

test("an unknown price resolves to null rather than Free", () => {
    // Callers must alert on this, not guess. Returning "free" here is what
    // turned a misconfigured environment into a silent downgrade.
    assert.equal(resolvePriceId("price_something_else"), null);
    assert.equal(resolvePriceId(null), null);
    assert.equal(resolvePriceId(""), null);
});

test("invoice subscription is read from both the Basil and legacy shapes", () => {
    // Basil moved this onto invoice.parent.subscription_details.
    assert.equal(
        subscriptionIdFromInvoice({
            parent: { subscription_details: { subscription: "sub_new" } },
        }),
        "sub_new",
    );

    // Pre-Basil shape.
    assert.equal(subscriptionIdFromInvoice({ subscription: "sub_old" }), "sub_old");

    // Expanded object rather than a bare id.
    assert.equal(
        subscriptionIdFromInvoice({
            parent: { subscription_details: { subscription: { id: "sub_expanded" } } },
        }),
        "sub_expanded",
    );

    // The new shape wins when both are present.
    assert.equal(
        subscriptionIdFromInvoice({
            parent: { subscription_details: { subscription: "sub_new" } },
            subscription: "sub_old",
        }),
        "sub_new",
    );
});

test("a one-off invoice has no subscription", () => {
    assert.equal(subscriptionIdFromInvoice({}), null);
    assert.equal(subscriptionIdFromInvoice(null), null);
    assert.equal(subscriptionIdFromInvoice({ parent: {} }), null);
    assert.equal(subscriptionIdFromInvoice({ subscription: "" }), null);
});
