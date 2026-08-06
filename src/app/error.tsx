"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Without this, any render error anywhere in the app showed Next's raw error
 * screen — stack trace and all in development, and an unbranded failure page in
 * production.
 */
export default function Error({
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
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="w-full max-w-md space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
                    <AlertTriangle className="h-5 w-5" />
                </div>

                <h1 className="text-xl font-semibold">Something went wrong</h1>

                <p className="text-sm text-muted-foreground">
                    This one is on us. Try again, and if it keeps happening let us
                    know.
                </p>

                {error.digest && (
                    <p className="font-mono text-xs text-muted-foreground">
                        Reference: {error.digest}
                    </p>
                )}

                <div className="flex justify-center gap-3 pt-2">
                    <Button onClick={reset}>Try again</Button>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard">Back to dashboard</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
