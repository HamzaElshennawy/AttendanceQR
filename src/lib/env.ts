/**
 * Environment access with fail-fast validation.
 *
 * Every `process.env.X!` in this codebase used to assert non-null and then fail
 * somewhere deep in a request — a missing service-role key surfaced as an
 * unrelated Supabase error, and a missing price ID silently downgraded a paying
 * customer to Free. These accessors throw once, at the point of use, naming the
 * variable that is missing.
 *
 * Groups are validated independently so a developer without Stripe credentials
 * can still boot the app and work on attendance.
 */

function required(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}. See .env.example.`,
        );
    }

    return value;
}

/**
 * Accepts the first name that is set. Used so the rename of
 * STRIPE_PLUS_PRICE_ID -> STRIPE_PLUS_MONTHLY_PRICE_ID does not break a
 * deployment that has not been updated yet.
 */
function requiredOneOf(names: [string, ...string[]]): string {
    for (const name of names) {
        const value = process.env[name];
        if (value) {
            return value;
        }
    }

    throw new Error(
        `Missing required environment variable: ${names[0]}. See .env.example.`,
    );
}

export function supabaseEnv() {
    return {
        url: required("NEXT_PUBLIC_SUPABASE_URL"),
        anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    };
}

export function supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function stripeEnv() {
    return {
        secretKey: required("STRIPE_SECRET_KEY"),
        webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    };
}

export function stripePriceEnv() {
    return {
        plusMonthly: requiredOneOf([
            "STRIPE_PLUS_MONTHLY_PRICE_ID",
            "STRIPE_PLUS_PRICE_ID",
        ]),
        plusAnnual: required("STRIPE_PLUS_ANNUAL_PRICE_ID"),
        proMonthly: requiredOneOf([
            "STRIPE_PRO_MONTHLY_PRICE_ID",
            "STRIPE_PRO_PRICE_ID",
        ]),
        proAnnual: required("STRIPE_PRO_ANNUAL_PRICE_ID"),
    };
}

/**
 * Absolute origin, no trailing slash.
 *
 * Previously three modules each invented their own fallback
 * (`localhost:3000`, `quorum.app`, `quorum-qr.vercel.app`), so Stripe redirects,
 * the sitemap, and robots.txt could disagree about what the site is called.
 * This is the single answer.
 */
export function appBaseUrl(): string {
    const configured =
        process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;

    if (configured) {
        return configured.replace(/\/+$/, "");
    }

    // A production build silently pointing at localhost breaks checkout returns
    // and emits a sitemap nobody can crawl. Fail instead.
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "Missing required environment variable: NEXT_PUBLIC_APP_URL. See .env.example.",
        );
    }

    return "http://localhost:3000";
}
