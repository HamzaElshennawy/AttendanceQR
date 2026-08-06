import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limiting against the `check_rate_limit` Postgres function.
 *
 * There was previously no limiting anywhere, which left the public endpoints
 * open to roster enumeration, bulk account creation, and exam access-code
 * brute forcing.
 */

export interface RateLimitRule {
    /** Distinct namespace so different routes cannot consume each other's budget. */
    name: string;
    limit: number;
    windowSeconds: number;
}

export const RATE_LIMITS = {
    /**
     * Generous: a full lecture theatre scans within a minute or two, and a
     * blocked check-in is a student marked absent. This is sized to stop
     * scripted enumeration, not to throttle a real class.
     */
    attend: { name: "attend", limit: 30, windowSeconds: 60 },
    /**
     * Counts only failed student lookups.
     *
     * This is the anti-enumeration control. Keeping it separate means a student
     * who mistypes their ID still gets a useful error, while a script walking
     * the ID space is stopped after a handful of misses — rather than blunting
     * the error messages for everyone, which is the usual and worse trade.
     */
    attendFailure: { name: "attend-failure", limit: 8, windowSeconds: 600 },
    register: { name: "register", limit: 5, windowSeconds: 3600 },
    examStart: { name: "exam-start", limit: 10, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Best-effort client address.
 *
 * Trusts the proxy headers because the app runs behind one. A determined
 * attacker can rotate addresses, so this raises the cost of automation rather
 * than making it impossible — the per-resource keys below matter more.
 */
export function clientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");

    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) {
            return first;
        }
    }

    return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

/**
 * Fails open.
 *
 * If the limiter itself is broken, blocking a lecture's worth of attendance
 * check-ins is a worse outcome than briefly allowing unthrottled traffic. The
 * failure is logged so it does not pass unnoticed.
 */
export async function checkRateLimit(
    rule: RateLimitRule,
    ...identifiers: (string | null | undefined)[]
): Promise<RateLimitResult> {
    const key = [rule.name, ...identifiers.map((part) => part || "unknown")].join(
        ":",
    );

    try {
        const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
            p_key: key,
            p_limit: rule.limit,
            p_window_seconds: rule.windowSeconds,
        });

        if (error) {
            logger.error("Rate limit check failed, allowing request", {
                rule: rule.name,
                error,
            });
            return { allowed: true, retryAfterSeconds: 0 };
        }

        return {
            allowed: data !== false,
            retryAfterSeconds: rule.windowSeconds,
        };
    } catch (error) {
        logger.error("Rate limit check threw, allowing request", {
            rule: rule.name,
            error,
        });
        return { allowed: true, retryAfterSeconds: 0 };
    }
}

export function tooManyRequests(result: RateLimitResult, message: string) {
    return Response.json(
        { error: message, code: "RATE_LIMITED" },
        {
            status: 429,
            headers: { "Retry-After": String(result.retryAfterSeconds) },
        },
    );
}
