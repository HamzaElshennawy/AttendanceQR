"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Loader2, PauseCircle, Sparkles } from "lucide-react";
import {
    PLAN_DEFINITIONS,
    annualSavingMonths,
    formatPrice,
    formatQuota,
    isUpgrade,
    type BillingInterval,
    type EntitlementFeature,
    type PlanTier,
} from "@/lib/plans";
import { CancelRetentionDialog } from "@/components/billing/CancelRetentionDialog";

interface BillingSummary {
    subscription: {
        plan_tier: PlanTier;
        status: string;
        billing_interval: BillingInterval;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        stripe_subscription_id: string | null;
    };
    plan: { tier: PlanTier; label: string };
    subscribedPlan: { tier: PlanTier; label: string };
    usage: {
        groups: number;
        students: number;
        sessionsThisMonth: number;
        teamMembers: number;
    };
    // null means unlimited: Infinity does not survive JSON serialization.
    quotas: {
        groups: number | null;
        students: number | null;
        sessionsPerMonth: number | null;
        teamMembers: number | null;
    };
    features: Record<EntitlementFeature, boolean>;
    isPaused: boolean;
    pausedUntil: string | null;
    trial: {
        isTrialing: boolean;
        hasUsedTrial: boolean;
        endsAt: string | null;
        daysRemaining: number;
    };
    canStartTrial: boolean;
    trialPeriodDays: number;
}

function formatDate(value: string | null) {
    if (!value) return null;

    return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function UsageRow({
    label,
    used,
    limit,
}: {
    label: string;
    used: number;
    limit: number | null;
}) {
    // JSON has no Infinity, so an unlimited quota arrives as null.
    const unlimited = typeof limit !== "number" || !Number.isFinite(limit);
    const percent = unlimited
        ? 0
        : Math.min(100, (used / Math.max(1, limit)) * 100);
    const atLimit = !unlimited && used >= limit;

    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span
                    className={
                        atLimit ? "font-medium text-destructive" : "font-medium"
                    }
                >
                    {used} / {unlimited ? "Unlimited" : formatQuota(limit)}
                </span>
            </div>
            {!unlimited && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className={`h-full rounded-full transition-all ${atLimit ? "bg-destructive" : "bg-foreground/70"}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    );
}

export function BillingPanel() {
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [interval, setInterval] = useState<BillingInterval>("month");
    const [actionLoading, setActionLoading] = useState<
        "" | "plus" | "pro" | "portal"
    >("");
    const [error, setError] = useState("");
    const [cancelOpen, setCancelOpen] = useState(false);

    // Bumping this refetches. State is only ever set inside the async closure,
    // after an await — setting it synchronously in an effect body triggers a
    // cascading render, which the compiler rejects.
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await fetch("/api/billing/summary");

                // Parsed defensively and after the status check. A 500 with an
                // empty body used to throw here, and because setLoading(false)
                // came after, the panel span forever instead of showing the
                // error it already knew how to render.
                const payload = await response
                    .json()
                    .catch(() => null as BillingSummary | null);

                if (cancelled) {
                    return;
                }

                if (response.ok && payload) {
                    setSummary(payload as BillingSummary);
                    setInterval(
                        (payload as BillingSummary).subscription
                            .billing_interval || "month",
                    );
                } else {
                    setSummary(null);
                    setError(
                        (payload as { error?: string } | null)?.error ||
                            "Could not load billing information.",
                    );
                }
            } catch {
                if (!cancelled) {
                    setSummary(null);
                    setError("Could not reach the billing service.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

    const handleUpgrade = async (plan: "plus" | "pro") => {
        setActionLoading(plan);
        setError("");

        const response = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan, interval }),
        }).catch(() => null);

        // Same defensive parse as the summary fetch: an unparseable body must
        // not leave the button spinning with no explanation.
        const payload = response
            ? await response.json().catch(() => ({}))
            : {};
        setActionLoading("");

        if (!response) {
            setError("Could not reach the billing service.");
            return;
        }

        if (payload.code === "SUBSCRIPTION_EXISTS") {
            // Changing an existing subscription belongs in the portal, which
            // prorates instead of creating a second subscription.
            await handlePortal();
            return;
        }

        if (!response.ok || !payload.url) {
            setError(payload.error || "Failed to start checkout.");
            return;
        }

        window.location.assign(payload.url);
    };

    const handlePortal = async () => {
        setActionLoading("portal");
        setError("");

        const response = await fetch("/api/billing/portal", {
            method: "POST",
        }).catch(() => null);

        const payload = response
            ? await response.json().catch(() => ({}))
            : {};
        setActionLoading("");

        if (!response) {
            setError("Could not reach the billing service.");
            return;
        }

        if (!response.ok || !payload.url) {
            setError(payload.error || "Failed to open the billing portal.");
            return;
        }

        window.location.assign(payload.url);
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading billing…
                </CardContent>
            </Card>
        );
    }

    if (!summary) {
        return (
            <Card>
                <CardContent className="flex items-center gap-2 py-8 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error || "Billing information is unavailable."}
                </CardContent>
            </Card>
        );
    }

    const {
        subscription,
        plan,
        usage,
        quotas,
        isPaused,
        pausedUntil,
        trial,
        canStartTrial,
        trialPeriodDays,
    } = summary;
    const renewsOn = formatDate(subscription.current_period_end);
    const hasSubscription = Boolean(subscription.stripe_subscription_id);
    const trialEndsOn = formatDate(trial.endsAt);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Plan and usage</CardTitle>
                    <CardDescription>
                        Your current plan, what it includes, and how much of it
                        you&apos;ve used.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-semibold">
                                    {plan.label}
                                </span>
                                <Badge variant="secondary">
                                    {trial.isTrialing
                                        ? "Free trial"
                                        : subscription.status}
                                </Badge>
                                {subscription.billing_interval === "year" && (
                                    <Badge variant="outline">Annual</Badge>
                                )}
                            </div>
                            {renewsOn && !isPaused && (
                                <p className="text-sm text-muted-foreground">
                                    {subscription.cancel_at_period_end
                                        ? `Ends on ${renewsOn}`
                                        : trial.isTrialing
                                          ? `First payment on ${renewsOn}`
                                          : `Renews on ${renewsOn}`}
                                </p>
                            )}
                        </div>

                        {hasSubscription && (
                            <Button
                                variant="outline"
                                onClick={handlePortal}
                                disabled={actionLoading !== ""}
                            >
                                {actionLoading === "portal" && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Manage billing
                            </Button>
                        )}
                    </div>

                    {trial.isTrialing && (
                        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p>
                                You&apos;re on a free trial of {plan.label} —{" "}
                                <span className="font-medium">
                                    {trial.daysRemaining}{" "}
                                    {trial.daysRemaining === 1 ? "day" : "days"}{" "}
                                    left
                                </span>
                                {trialEndsOn ? `, ending ${trialEndsOn}` : ""}.
                                You won&apos;t be charged until it ends, and you
                                can cancel any time before then.
                            </p>
                        </div>
                    )}

                    {canStartTrial && (
                        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p>
                                Your first paid plan starts with a{" "}
                                <span className="font-medium">
                                    {trialPeriodDays}-day free trial
                                </span>
                                . Pick a plan below — nothing is charged until
                                the trial ends.
                            </p>
                        </div>
                    )}

                    {isPaused && (
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
                            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Your plan is paused
                                {formatDate(pausedUntil)
                                    ? ` until ${formatDate(pausedUntil)}`
                                    : ""}
                                . You won&apos;t be billed, and everything is kept
                                exactly as you left it.
                            </p>
                        </div>
                    )}

                    {subscription.cancel_at_period_end && !isPaused && (
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Your plan is set to end
                                {renewsOn ? ` on ${renewsOn}` : ""}. You keep full
                                access until then.
                            </p>
                        </div>
                    )}

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <UsageRow
                            label="Groups"
                            used={usage.groups}
                            limit={quotas.groups}
                        />
                        <UsageRow
                            label="Students"
                            used={usage.students}
                            limit={quotas.students}
                        />
                        <UsageRow
                            label="Sessions this month"
                            used={usage.sessionsThisMonth}
                            limit={quotas.sessionsPerMonth}
                        />
                        <UsageRow
                            label="Team members"
                            used={usage.teamMembers}
                            limit={quotas.teamMembers}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change your plan</CardTitle>
                    <CardDescription>
                        Move up when you need more room, or switch to annual to pay
                        for fewer months.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="inline-flex rounded-lg border border-border p-1">
                        {(["month", "year"] as BillingInterval[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setInterval(option)}
                                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                                    interval === option
                                        ? "bg-foreground text-background"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {option === "month" ? "Monthly" : "Annual"}
                                {option === "year" && (
                                    <span className="ml-1.5 text-xs opacity-80">
                                        save {annualSavingMonths("plus")} months
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {(["plus", "pro"] as const).map((tier) => {
                            const definition = PLAN_DEFINITIONS[tier];
                            const isCurrent =
                                subscription.plan_tier === tier &&
                                subscription.billing_interval === interval;

                            return (
                                <div
                                    key={tier}
                                    className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4"
                                >
                                    <div className="space-y-1">
                                        <p className="font-medium">
                                            {definition.label}
                                        </p>
                                        <p className="text-2xl font-semibold">
                                            {formatPrice(tier, interval)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatQuota(definition.quotas.groups)}{" "}
                                            groups ·{" "}
                                            {formatQuota(
                                                definition.quotas.students,
                                            )}{" "}
                                            students
                                            {definition.features.exams
                                                ? " · exams"
                                                : ""}
                                        </p>
                                        {canStartTrial && (
                                            <p className="text-xs font-medium text-primary">
                                                Free for the first{" "}
                                                {trialPeriodDays} days
                                            </p>
                                        )}
                                    </div>

                                    <Button
                                        onClick={() => handleUpgrade(tier)}
                                        disabled={isCurrent || actionLoading !== ""}
                                        variant={
                                            isUpgrade(subscription.plan_tier, tier)
                                                ? "default"
                                                : "outline"
                                        }
                                    >
                                        {actionLoading === tier && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        {isCurrent
                                            ? "Current plan"
                                            : canStartTrial
                                              ? `Start ${trialPeriodDays}-day free trial`
                                              : `Switch to ${definition.label}`}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    {error && (
                        <p className="flex items-center gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </p>
                    )}

                    {hasSubscription &&
                        !subscription.cancel_at_period_end &&
                        !isPaused && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-muted-foreground">
                                        Need to stop for a while?
                                    </p>
                                    <Button
                                        variant="ghost"
                                        className="text-muted-foreground"
                                        onClick={() => setCancelOpen(true)}
                                    >
                                        Cancel plan
                                    </Button>
                                </div>
                            </>
                        )}
                </CardContent>
            </Card>

            <CancelRetentionDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                onCompleted={refresh}
            />
        </>
    );
}
