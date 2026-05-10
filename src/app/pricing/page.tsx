import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, Sparkles } from "lucide-react";
import { QuorumIcon } from "@/components/QuorumLogo";

/*
Original pricing page intentionally commented out instead of deleted.
Kept here so we can restore or refine the full pricing rollout later.

import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, Mail, ShieldCheck } from "lucide-react";

const plans = [
    {
        name: "Free",
        price: "$0",
        cadence: "/month",
        audience: "Individual instructor or small pilot",
        summary:
            "Discover the full product surface with strict pilot limits for a single teaching workspace.",
        cta: "Start free",
        href: "/register",
        features: [
            "1 teaching workspace",
            "QR attendance sessions",
            "Coursework visibility",
            "Basic attendance exports",
            "50 students and 10 sessions / month",
        ],
    },
    {
        name: "Plus",
        price: "$5",
        cadence: "/month",
        audience: "Instructors and small teaching teams",
        summary:
            "The best balance for coursework operations, collaboration, imports, exports, and larger quotas.",
        cta: "Upgrade to Plus",
        href: "/dashboard/settings",
        featured: true,
        features: [
            "Up to 5 groups and 500 students",
            "Team roles and collaboration",
            "Coursework exports and rich reporting",
            "Spreadsheet imports",
            "200 sessions / month",
        ],
    },
    {
        name: "Pro",
        price: "$10",
        cadence: "/month",
        audience: "Full academic operations",
        summary:
            "Unlock exams, advanced controls, premium reporting surfaces, and the full instructor feature set.",
        cta: "Upgrade to Pro",
        href: "/dashboard/settings",
        features: [
            "Everything in Plus",
            "Exam setup and student exam flow",
            "Advanced exports and controls",
            "High practical limits",
            "Future premium features included",
        ],
    },
];

const comparisonRows = [
    ["QR attendance sessions", "Yes", "Yes", "Yes"],
    ["Coursework and grade entry", "Yes", "Yes", "Yes"],
    ["Team roles and collaboration", "-", "Yes", "Yes"],
    ["Coursework exports and reporting", "Basic", "Yes", "Yes"],
    ["Exam management", "-", "-", "Yes"],
    ["Group quota", "1", "5", "High"],
    ["Student quota", "50", "500", "High"],
];

The previous live page also included:
- a pricing hero with breadcrumb + "Pricing and packages"
- a recommended-path section
- three pricing cards
- a comparison table
- an upgrade path / contact sales section
*/

export default async function PricingPage() {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
                <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary shadow-sm">
                            <QuorumIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-lg font-semibold tracking-tight text-foreground">
                                Quorum
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Academic operations
                            </div>
                        </div>
                    </Link>

                    <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
                        <Link href="/" className="transition-colors hover:text-primary">
                            Home
                        </Link>
                        <Link
                            href="/login"
                            className="transition-colors hover:text-primary"
                        >
                            Sign in
                        </Link>
                        {session ? (
                            <Button asChild>
                                <Link href="/dashboard">Open dashboard</Link>
                            </Button>
                        ) : (
                            <Button asChild>
                                <Link href="/register">Start free</Link>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main>
                <section className="border-y border-border/70 bg-card/55 py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                Coming soon
                            </div>
                            <h1 className="mt-6 font-display text-4xl text-foreground sm:text-5xl">
                                Pricing is coming soon.
                            </h1>
                            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                                We are preparing flexible packages for instructors,
                                teams, and departments. In the meantime, all features
                                are available at no cost.
                            </p>
                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                {session ? (
                                    <Button asChild size="lg" className="rounded-full px-7">
                                        <Link href="/dashboard">
                                            Open dashboard
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button asChild size="lg" className="rounded-full px-7">
                                        <Link href="/register">
                                            Start free
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                                <Button
                                    asChild
                                    size="lg"
                                    variant="outline"
                                    className="rounded-full px-7"
                                >
                                    <Link href="/">Back to home</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
