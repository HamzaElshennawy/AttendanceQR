"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for errors thrown by the root layout itself.
 *
 * Replaces the whole document, so it must render its own <html> and <body> and
 * cannot rely on the app's providers, fonts, or global stylesheet — styles are
 * inline for that reason.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    fontFamily:
                        "ui-sans-serif, system-ui, -apple-system, sans-serif",
                    display: "flex",
                    minHeight: "100vh",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: 0,
                    padding: "1.5rem",
                }}
            >
                <div style={{ maxWidth: "28rem", textAlign: "center" }}>
                    <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
                        Something went wrong
                    </h1>

                    <p
                        style={{
                            fontSize: "0.875rem",
                            opacity: 0.7,
                            marginBottom: "1.25rem",
                        }}
                    >
                        The app failed to load. Reloading usually clears it.
                    </p>

                    {error.digest && (
                        <p
                            style={{
                                fontFamily: "ui-monospace, monospace",
                                fontSize: "0.75rem",
                                opacity: 0.6,
                                marginBottom: "1.25rem",
                            }}
                        >
                            Reference: {error.digest}
                        </p>
                    )}

                    <button
                        onClick={reset}
                        style={{
                            border: "1px solid currentColor",
                            borderRadius: "0.5rem",
                            padding: "0.5rem 1.25rem",
                            background: "transparent",
                            cursor: "pointer",
                            font: "inherit",
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
