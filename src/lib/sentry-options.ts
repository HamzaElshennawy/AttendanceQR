/**
 * Shared Sentry options.
 *
 * Everything is inert without SENTRY_DSN, so the app runs unchanged locally and
 * in CI. Set NEXT_PUBLIC_SENTRY_DSN in production to turn it on.
 */

export const sentryDsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

export const sentryEnabled = Boolean(sentryDsn);

export const baseSentryOptions = {
    dsn: sentryDsn,
    enabled: sentryEnabled,
    environment: process.env.NODE_ENV,
    // Errors matter more than volume here; traces are sampled lightly so a
    // lecture-hall traffic spike does not blow through the quota.
    tracesSampleRate: 0.1,
    // Never ship request bodies or headers: they carry attendance data, exam
    // answers, and session cookies.
    sendDefaultPii: false,
};
