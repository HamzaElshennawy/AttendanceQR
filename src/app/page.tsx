import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
    ArrowRight,
    Building2,
    ClipboardCheck,
    Clock3,
    FileSpreadsheet,
    GraduationCap,
    MapPinned,
    QrCode,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react";
import { QuorumIcon } from "@/components/QuorumLogo";

const heroStats = [
    { label: "Attendance check-ins", value: "Seconds" },
    { label: "Instructor workspace", value: "One place" },
    { label: "Procurement posture", value: "Institution-ready" },
];

const featurePillars = [
    {
        icon: QrCode,
        title: "Fast classroom attendance",
        description:
            "Run rotating QR attendance with location-aware validation and live session control that stays readable under pressure.",
    },
    {
        icon: ClipboardCheck,
        title: "Coursework and grading flow",
        description:
            "Manage quizzes, assignments, practicals, midterms, and finals with spreadsheet imports, grading breakdowns, and clear review states.",
    },
    {
        icon: Building2,
        title: "Institutional trust",
        description:
            "Present a calmer, procurement-friendly system with clearer controls, safer workflows, and policy-friendly reporting surfaces.",
    },
];

const workflowSteps = [
    {
        eyebrow: "1. Prepare",
        title: "Open the teaching workspace",
        description:
            "Professors and TAs land in a structured dashboard for groups, sessions, coursework, and student lookup without hunting across disconnected tools.",
    },
    {
        eyebrow: "2. Run live attendance",
        title: "Launch QR attendance with confidence",
        description:
            "Live session controls make attendance visible in real time, while projection-friendly QR mode keeps classroom check-in friction low.",
    },
    {
        eyebrow: "3. Grade and report",
        title: "Move directly into coursework and exports",
        description:
            "Spreadsheet imports, weighted grading, and export-ready records reduce the manual cleanup that usually follows each class or exam cycle.",
    },
];

const proofStrip = [
    "Live QR attendance",
    "Spreadsheet-friendly grading",
    "Student review flows",
    "Department-ready reporting",
];

const packagePreview = [
    {
        name: "Free",
        audience: "Single instructor pilot",
        price: "free",
        blurb: "A small-pilot plan with QR attendance, coursework visibility, and tight usage limits for evaluation.",
    },
    {
        name: "Plus",
        audience: "Instructors who need collaboration",
        price: "$5",
        blurb: "Adds team sharing, coursework exports, richer reporting, and larger teaching limits.",
        featured: true,
    },
    {
        name: "Pro",
        audience: "Full academic operations",
        price: "$10",
        blurb: "Unlocks exams, advanced controls, and the full premium feature set with high practical limits.",
    },
];

export default async function LandingPage() {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const isLoggedIn = Boolean(session);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
                <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
                    <Link
                        href="/"
                        className="flex items-center gap-3"
                    >
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
                        <Link
                            href="/pricing"
                            className="transition-colors hover:text-primary"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/login"
                            className="transition-colors hover:text-primary"
                        >
                            Sign in
                        </Link>
                        {isLoggedIn ? (
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
                <section className="relative overflow-hidden border-b border-border/70">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(205,223,255,0.55),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(247,228,188,0.24),transparent_28%),linear-gradient(180deg,rgba(253,253,255,0.98),rgba(247,250,255,0.96))]" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                    <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-18 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground shadow-sm">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                UX-first attendance and coursework system
                            </div>
                            <div className="space-y-5">
                                <h1 className="max-w-4xl font-display text-5xl leading-none text-foreground sm:text-6xl lg:text-7xl">
                                    One academic operations workspace for
                                    attendance, coursework, and exams.
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                                    Quorum helps professors, TAs, departments,
                                    and academic operations teams move faster
                                    through live sessions, grading imports,
                                    student review, and export-ready reporting
                                    without giving up clarity.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {isLoggedIn ? (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="h-12 rounded-full px-7"
                                    >
                                        <Link href="/dashboard">
                                            Open dashboard
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            asChild
                                            size="lg"
                                            className="h-12 rounded-full px-7"
                                        >
                                            <Link href="/register">
                                                Start free
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="lg"
                                            variant="outline"
                                            className="h-12 rounded-full px-7"
                                        >
                                            <Link href="/pricing">
                                                View pricing
                                            </Link>
                                        </Button>
                                    </>
                                )}
                                <Button
                                    asChild
                                    size="lg"
                                    variant="ghost"
                                    className="h-12 rounded-full px-7 text-primary hover:text-primary"
                                >
                                    <a href="mailto:sales@quorum.app">
                                        Book a demo
                                    </a>
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {heroStats.map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-[22px] border border-border/70 bg-card/90 px-4 py-4 shadow-sm"
                                    >
                                        <div className="text-2xl font-semibold text-foreground">
                                            {item.value}
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {item.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {proofStrip.map((item) => (
                                    <div
                                        key={item}
                                        className="rounded-full border border-border/70 bg-card/90 px-3 py-2 text-sm text-muted-foreground shadow-sm"
                                    >
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-4 top-10 hidden h-28 w-28 rounded-[28px] border border-white/70 bg-white/60 blur-sm lg:block" />
                            <div className="relative overflow-hidden rounded-[34px] border border-border/70 bg-card shadow-[0_30px_80px_-48px_rgba(22,47,95,0.42)]">
                                <div className="border-b border-border/70 bg-background/80 px-5 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">
                                                Quorum workspace
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Live classroom control with
                                                coursework follow-through
                                            </div>
                                        </div>
                                        <Badge variant="success">Live</Badge>
                                    </div>
                                </div>
                                <div className="space-y-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,255,0.96))] p-5">
                                    <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                                        <div className="rounded-[26px] bg-primary px-5 py-5 text-primary-foreground shadow-[0_20px_50px_-32px_rgba(22,47,95,0.65)]">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                                                Live attendance
                                            </div>
                                            <div className="mt-3 text-2xl font-semibold">
                                                CS102 • Lecture 05
                                            </div>
                                            <p className="mt-2 max-w-sm text-sm leading-6 text-primary-foreground/82">
                                                Projection-friendly QR, visible
                                                live status, and quick lecturer
                                                actions for the active classroom
                                                moment.
                                            </p>
                                            <div className="mt-6 grid grid-cols-2 gap-3">
                                                <div className="rounded-[20px] border border-white/14 bg-white/10 px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.24em] text-primary-foreground/65">
                                                        Present
                                                    </div>
                                                    <div className="mt-2 text-2xl font-semibold">
                                                        84
                                                    </div>
                                                </div>
                                                <div className="rounded-[20px] border border-white/14 bg-white/10 px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.24em] text-primary-foreground/65">
                                                        Late
                                                    </div>
                                                    <div className="mt-2 text-2xl font-semibold">
                                                        7
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="rounded-[24px] border border-border/70 bg-background px-4 py-4">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                                    Coursework pipeline
                                                </div>
                                                <div className="mt-3 space-y-3">
                                                    {[
                                                        [
                                                            "Quiz import",
                                                            "32 of 40 grades matched",
                                                        ],
                                                        [
                                                            "Weighted grading",
                                                            "Attendance included in final blend",
                                                        ],
                                                        [
                                                            "Exam setup",
                                                            "Question groups and launch review ready",
                                                        ],
                                                    ].map(([title, meta]) => (
                                                        <div
                                                            key={title}
                                                            className="rounded-[18px] border border-border/60 bg-card px-3 py-3"
                                                        >
                                                            <div className="text-sm font-medium text-foreground">
                                                                {title}
                                                            </div>
                                                            <div className="mt-1 text-xs text-muted-foreground">
                                                                {meta}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="rounded-[24px] border border-border/70 bg-background px-4 py-4">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                                    Evaluation fit
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                                                    <div className="rounded-[18px] bg-primary/6 px-3 py-3 text-primary">
                                                        Department review
                                                        friendly
                                                    </div>
                                                    <div className="rounded-[18px] bg-primary/6 px-3 py-3 text-primary">
                                                        Fast TA onboarding
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-b border-border/70 bg-card/55 py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="max-w-3xl">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Why Quorum
                            </div>
                            <h2 className="mt-4 font-display text-4xl text-foreground">
                                A stronger external story without drifting away
                                from the real product.
                            </h2>
                            <p className="mt-4 text-lg leading-8 text-muted-foreground">
                                The experience is designed for high-frequency
                                academic work: live attendance, fast import
                                review, safer grading actions, and clearer
                                accountability when teams share responsibility.
                            </p>
                        </div>
                        <div className="mt-10 grid gap-5 lg:grid-cols-3">
                            {featurePillars.map((pillar) => (
                                <article
                                    key={pillar.title}
                                    className="rounded-[28px] border border-border/70 bg-background px-5 py-6 shadow-sm"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                        <pillar.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-5 text-xl font-semibold text-foreground">
                                        {pillar.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                                        {pillar.description}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-b border-border/70 bg-background py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="grid gap-5 lg:grid-cols-3">
                            {[
                                [
                                    "UX principle",
                                    "Keep the next action obvious",
                                    "Instructors see the live state, the next action, and the consequence without searching through the interface.",
                                ],
                                [
                                    "Operational value",
                                    "Reduce cleanup after each class",
                                    "Attendance, coursework, exports, and student review stay connected so less work spills into spreadsheets later.",
                                ],
                                [
                                    "Institution fit",
                                    "Present a calmer system externally",
                                    "Departments can evaluate Quorum through clearer workflows and cleaner surfaces instead of a prototype-feeling tool.",
                                ],
                            ].map(([eyebrow, title, copy]) => (
                                <article
                                    key={title}
                                    className="rounded-[28px] border border-border/70 bg-card px-5 py-6 shadow-sm"
                                >
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                        {eyebrow}
                                    </div>
                                    <h3 className="mt-4 text-2xl font-semibold text-foreground">
                                        {title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                                        {copy}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-18">
                    <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Operational flow
                            </div>
                            <h2 className="mt-4 font-display text-4xl text-foreground">
                                Made for the way classes actually move.
                            </h2>
                            <p className="mt-4 text-lg leading-8 text-muted-foreground">
                                Quorum keeps the UX direct for instructors while
                                still giving departments a system they can
                                evaluate and roll out responsibly.
                            </p>
                        </div>
                        <div className="space-y-4">
                            {workflowSteps.map((step) => (
                                <article
                                    key={step.title}
                                    className="rounded-[28px] border border-border/70 bg-card px-5 py-5 shadow-sm"
                                >
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                        {step.eyebrow}
                                    </div>
                                    <h3 className="mt-3 text-2xl font-semibold text-foreground">
                                        {step.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                                        {step.description}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
                {/* PRICING SECTION COMMENTED OUT — pricing is coming soon
                <section className="border-y border-border/70 bg-card/55 py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="flex flex-wrap items-end justify-between gap-5">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                    Packages
                                </div>
                                <h2 className="mt-4 font-display text-4xl text-foreground">
                                    Packages that are easy to scan in under a
                                    minute.
                                </h2>
                            </div>
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-full px-6"
                            >
                                <Link href="/pricing">Open full pricing</Link>
                            </Button>
                        </div>
                        <div className="mt-10 grid gap-5 lg:grid-cols-3">
                            {packagePreview.map((plan) => (
                                <article
                                    key={plan.name}
                                    className={`rounded-[30px] border px-5 py-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 ${plan.featured ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_24px_60px_-36px_rgba(22,47,95,0.55)]" : "border-border/70 bg-background hover:border-primary/20 hover:shadow-[0_22px_60px_-40px_rgba(22,47,95,0.18)]"}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3
                                                className={`text-2xl font-semibold ${plan.featured ? "text-primary-foreground" : "text-foreground"}`}
                                            >
                                                {plan.name}
                                            </h3>
                                            <p
                                                className={`mt-2 text-sm ${plan.featured ? "text-primary-foreground/78" : "text-muted-foreground"}`}
                                            >
                                                {plan.audience}
                                            </p>
                                        </div>
                                        {plan.featured ? (
                                            <Badge className="border-white/20 bg-white/10 text-primary-foreground">
                                                Most balanced
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div
                                        className={`mt-6 text-4xl font-semibold ${plan.featured ? "text-primary-foreground" : "text-foreground"}`}
                                    >
                                        {plan.price}
                                    </div>
                                    <p
                                        className={`mt-3 text-sm leading-7 ${plan.featured ? "text-primary-foreground/82" : "text-muted-foreground"}`}
                                    >
                                        {plan.blurb}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
                */}

                {/* Pricing coming soon notice */}
                <section className="border-y border-border/70 bg-card/55 py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                Coming soon
                            </div>
                            <h2 className="mt-6 font-display text-4xl text-foreground">
                                Pricing is coming soon.
                            </h2>
                            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                                We are preparing flexible packages for instructors,
                                teams, and departments. In the meantime, all features
                                are available at no cost.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="rounded-[34px] border border-border/70 bg-card px-6 py-8 shadow-[0_26px_70px_-48px_rgba(22,47,95,0.34)] md:px-8">
                            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                        Ready to evaluate
                                    </div>
                                    <h2 className="mt-4 font-display text-4xl text-foreground">
                                        Move from classroom friction to a
                                        cleaner academic operating model.
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                                        Whether you are piloting with a single
                                        instructor or evaluating for a
                                        department, Quorum gives you a credible
                                        starting point without asking teams to
                                        learn a tangled workflow.
                                    </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        {
                                            icon: Users,
                                            label: "Built for professors and TAs",
                                        },
                                        {
                                            icon: Clock3,
                                            label: "Live attendance in seconds",
                                        },
                                        {
                                            icon: FileSpreadsheet,
                                            label: "Import-friendly coursework",
                                        },
                                        {
                                            icon: GraduationCap,
                                            label: "Exam flow included",
                                        },
                                        {
                                            icon: MapPinned,
                                            label: "Venue-aware validation",
                                        },
                                        {
                                            icon: ShieldCheck,
                                            label: "Trustworthy reporting surfaces",
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="rounded-[22px] border border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground"
                                        >
                                            <item.icon className="mb-3 h-4 w-4 text-primary" />
                                            {item.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-8 flex flex-wrap gap-3">
                                {isLoggedIn ? (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="rounded-full px-7"
                                    >
                                        <Link href="/dashboard">
                                            Open dashboard
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="rounded-full px-7"
                                    >
                                        <Link href="/register">Start free</Link>
                                    </Button>
                                )}
                                <Button
                                    asChild
                                    size="lg"
                                    variant="outline"
                                    className="rounded-full px-7"
                                >
                                    <Link href="/pricing">
                                        Compare packages
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-border/70 bg-card/40 py-10">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary">
                            <QuorumIcon className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="font-semibold text-foreground">
                                Quorum
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Attendance and coursework operations for
                                academic teams.
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
                        <Link
                            href="/pricing"
                            className="transition-colors hover:text-primary"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/login"
                            className="transition-colors hover:text-primary"
                        >
                            Sign in
                        </Link>
                        <a
                            href="mailto:sales@quorum.app"
                            className="transition-colors hover:text-primary"
                        >
                            sales@quorum.app
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
