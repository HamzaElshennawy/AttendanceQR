import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions, sentryEnabled } from "@/lib/sentry-options";

if (sentryEnabled) {
    Sentry.init({
        ...baseSentryOptions,
        // Session replay is deliberately not enabled: these pages display
        // student names, IDs, attendance records, and exam questions.
        integrations: [],
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
