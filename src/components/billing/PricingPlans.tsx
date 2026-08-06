"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Minus } from "lucide-react";
import {
    PLAN_DEFINITIONS,
    PLAN_ORDER,
    annualSavingMonths,
    formatPrice,
    formatQuota,
    type BillingInterval,
    type EntitlementFeature,
} from "@/lib/plans";

const FEATURE_LABELS: { key: EntitlementFeature; label: string }[] = [
    { key: "coursework", label: "Coursework and grading" },
    { key: "spreadsheet_import", label: "Spreadsheet import" },
    { key: "rich_reporting", label: "Rich reporting" },
    { key: "advanced_exports", label: "Advanced exports" },
    { key: "team_members", label: "Team roles (TAs)" },
    { key: "exams", label: "Online exams" },
];

const PLAN_AUDIENCE: Record<string, string> = {
    free: "A single class, to try it out",
    plus: "Instructors and small teaching teams",
    pro: "Full academic operations",
};

export function PricingPlans({ signedIn }: { signedIn: boolean }) {
    const [interval, setInterval] = useState<BillingInterval>("month");

    const ctaHref = signedIn ? "/dashboard/settings" : "/register";

    return (
        <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col items-center text-center">
                <h1 className="font-display text-4xl text-foreground sm:text-5xl">
                    Pricing that fits the academic year
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                    Start free with a single class. Move up when you need more room,
                    and pay annually to cover twelve months for the price of ten.
                </p>

                <div
                    role="group"
                    aria-label="Billing interval"
                    className="mt-8 inline-flex rounded-full border border-border/70 bg-background p-1"
                >
                    {(["month", "year"] as BillingInterval[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setInterval(option)}
                            aria-pressed={interval === option}
                            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                                interval === option
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {option === "month" ? "Monthly" : "Annual"}
                        </button>
                    ))}
                </div>

                {interval === "year" && (
                    <p className="mt-3 text-sm text-muted-foreground">
                        Two months free on every paid plan.
                    </p>
                )}
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
                {PLAN_ORDER.map((tier) => {
                    const plan = PLAN_DEFINITIONS[tier];
                    const featured = tier === "plus";
                    const saving = annualSavingMonths(tier);

                    return (
                        <div
                            key={tier}
                            className={`flex flex-col rounded-2xl border p-6 ${
                                featured
                                    ? "border-primary/40 bg-card shadow-[0_24px_60px_-42px_rgba(22,47,95,0.35)]"
                                    : "border-border/70 bg-card/60"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-lg font-semibold">
                                    {plan.label}
                                </h2>
                                {featured && <Badge>Most popular</Badge>}
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                                {PLAN_AUDIENCE[tier]}
                            </p>

                            <div className="mt-6">
                                <span className="text-4xl font-semibold">
                                    {formatPrice(tier, interval).split("/")[0]}
                                </span>
                                {plan.pricing[interval] > 0 && (
                                    <span className="ml-1 text-sm text-muted-foreground">
                                        /{interval === "year" ? "year" : "month"}
                                    </span>
                                )}
                            </div>

                            {interval === "year" && saving > 0 && (
                                <p className="mt-1 text-sm text-primary">
                                    {saving} months free
                                </p>
                            )}

                            <ul className="mt-6 space-y-2.5 text-sm">
                                <li className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <span>
                                        {formatQuota(plan.quotas.groups)} groups,{" "}
                                        {formatQuota(plan.quotas.students)} students
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <span>
                                        {formatQuota(plan.quotas.sessionsPerMonth)}{" "}
                                        sessions per month
                                    </span>
                                </li>
                                {FEATURE_LABELS.map(({ key, label }) => (
                                    <li key={key} className="flex items-start gap-2">
                                        {plan.features[key] ? (
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                        ) : (
                                            <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                                        )}
                                        <span
                                            className={
                                                plan.features[key]
                                                    ? ""
                                                    : "text-muted-foreground/60"
                                            }
                                        >
                                            {label}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-8 pt-2">
                                <Button
                                    asChild
                                    className="w-full rounded-full"
                                    variant={featured ? "default" : "outline"}
                                >
                                    <Link href={ctaHref}>
                                        {tier === "free"
                                            ? "Start free"
                                            : `Choose ${plan.label}`}
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="mt-10 text-center text-sm text-muted-foreground">
                Plans are billed per instructor account. Change or cancel at any time
                from your settings.
            </p>
        </div>
    );
}
