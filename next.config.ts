import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * `unsafe-inline` and `unsafe-eval` on script-src are required by Next's inline
 * bootstrap and the React refresh runtime. Removing them means emitting a
 * per-request nonce from the proxy and threading it through, which is a
 * worthwhile follow-up but a larger change than adding headers. Everything else
 * is locked down: no framing, no plugins, no arbitrary form targets.
 */
function contentSecurityPolicy() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    // Supabase Realtime uses a websocket on the same host.
    const supabaseSocket = supabaseUrl.replace(/^https:/, "wss:");

    const directives: Record<string, string[]> = {
        "default-src": ["'self'"],
        "script-src": [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://va.vercel-scripts.com",
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "font-src": ["'self'", "data:"],
        "connect-src": [
            "'self'",
            supabaseUrl,
            supabaseSocket,
            "https://va.vercel-scripts.com",
        ].filter(Boolean),
        // Attendance check-in and exam pages are public; framing them is a
        // clickjacking vector.
        "frame-ancestors": ["'none'"],
        "form-action": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
    };

    return Object.entries(directives)
        .map(([directive, values]) => `${directive} ${values.join(" ")}`)
        .join("; ");
}

const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
        key: "Permissions-Policy",
        // Geolocation is kept: attendance check-in depends on it.
        value: "camera=(), microphone=(), payment=(), geolocation=(self)",
    },
];

const nextConfig: NextConfig = {
    reactCompiler: true,
    devIndicators: false,
    async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
    },
};

/**
 * Source-map upload is only wired up when the credentials exist, so local and
 * CI builds stay fast and quiet. Sentry itself is controlled separately by
 * SENTRY_DSN — see src/lib/sentry-options.ts.
 */
const { SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN } = process.env;

export default SENTRY_ORG && SENTRY_PROJECT && SENTRY_AUTH_TOKEN
    ? withSentryConfig(nextConfig, {
          org: SENTRY_ORG,
          project: SENTRY_PROJECT,
          authToken: SENTRY_AUTH_TOKEN,
          silent: true,
          widenClientFileUpload: true,
          disableLogger: true,
          // Strips the uploaded maps from the client bundle so stack traces
          // resolve in Sentry without publishing sources to visitors.
          sourcemaps: { deleteSourcemapsAfterUpload: true },
      })
    : nextConfig;
