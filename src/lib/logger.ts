/**
 * Structured logging with secret redaction.
 *
 * Replaces bare `console.*`. The Stripe webhook in particular used to print its
 * configured price IDs and full event payloads on every request, which puts
 * billing configuration into any log aggregator that ingests stdout.
 *
 * Emits one JSON object per line in production so logs stay parseable, and a
 * readable form in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Keys whose values are never safe to log. Matched case-insensitively against
 * the key name, so `stripe_secret_key` and `Authorization` are both caught.
 */
const SENSITIVE_KEY = /secret|token|password|signature|authorization|api[-_]?key|service[-_]?role/i;

const REDACTED = "[redacted]";

function redact(value: unknown, depth = 0): unknown {
    if (depth > 6 || value == null) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => redact(entry, depth + 1));
    }

    if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
    }

    if (typeof value === "object") {
        const output: Record<string, unknown> = {};

        for (const [key, entry] of Object.entries(value)) {
            output[key] = SENSITIVE_KEY.test(key)
                ? REDACTED
                : redact(entry, depth + 1);
        }

        return output;
    }

    return value;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const payload = {
        level,
        message,
        time: new Date().toISOString(),
        ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
    };

    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    if (process.env.NODE_ENV === "production") {
        sink(JSON.stringify(payload));
        return;
    }

    sink(`[${level}] ${message}`, context ? redact(context) : "");
}

export const logger = {
    debug: (message: string, context?: Record<string, unknown>) => {
        if (process.env.NODE_ENV !== "production") {
            emit("debug", message, context);
        }
    },
    info: (message: string, context?: Record<string, unknown>) =>
        emit("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
        emit("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) =>
        emit("error", message, context),
};
