import test from "node:test";
import assert from "node:assert/strict";

import { secureEquals } from "@/lib/secure-compare";

test("matching strings compare equal", () => {
    assert.equal(secureEquals("EXAM2026", "EXAM2026"), true);
    assert.equal(secureEquals("", ""), true);
    assert.equal(secureEquals("ünïcødé", "ünïcødé"), true);
});

test("differing strings compare unequal", () => {
    assert.equal(secureEquals("EXAM2026", "EXAM2027"), false);
    // Differing only in the first character — the case a short-circuiting
    // comparison would reject fastest, and the one that made `!==` an oracle.
    assert.equal(secureEquals("EXAM2026", "AXAM2026"), false);
    assert.equal(secureEquals("EXAM2026", "exam2026"), false);
});

test("length differences do not throw", () => {
    // Both sides are hashed to a fixed width first, so timingSafeEqual never
    // sees mismatched buffer lengths.
    assert.equal(secureEquals("a", "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
    assert.equal(secureEquals("EXAM2026", ""), false);
});

test("absent values never match", () => {
    assert.equal(secureEquals(null, null), false);
    assert.equal(secureEquals(undefined, undefined), false);
    assert.equal(secureEquals("EXAM2026", null), false);
    assert.equal(secureEquals(null, "EXAM2026"), false);
    assert.equal(secureEquals("EXAM2026", undefined), false);
});
