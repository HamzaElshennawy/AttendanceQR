import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison.
 *
 * Exam access codes were compared with `!==`, which short-circuits on the first
 * differing character. Combined with an unauthenticated, unthrottled endpoint
 * that is a usable oracle. Both sides are hashed first so the comparison is over
 * fixed-length buffers and the code's length does not leak either.
 */
export function secureEquals(
    a: string | null | undefined,
    b: string | null | undefined,
): boolean {
    if (a == null || b == null) {
        // Nothing to compare — a missing code is not a match.
        return false;
    }

    const digestA = createHash("sha256").update(a, "utf8").digest();
    const digestB = createHash("sha256").update(b, "utf8").digest();

    return timingSafeEqual(digestA, digestB);
}
