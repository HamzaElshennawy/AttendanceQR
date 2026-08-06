import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions, sentryEnabled } from "@/lib/sentry-options";

export async function register() {
    if (!sentryEnabled) {
        return;
    }

    // Node and edge runtimes both reach this hook; the SDK picks the right
    // integrations from the runtime it is initialised in.
    if (
        process.env.NEXT_RUNTIME === "nodejs" ||
        process.env.NEXT_RUNTIME === "edge"
    ) {
        Sentry.init(baseSentryOptions);
    }
}

/**
 * Captures server-side render and route handler errors that Next would
 * otherwise only surface in the platform log.
 */
export const onRequestError = Sentry.captureRequestError;
