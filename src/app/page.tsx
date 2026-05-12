import Link from "next/link";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
    title: "QR Attendance and Grading for Teachers",
    description:
        "Use Quorum to take attendance with QR codes, record grades, and keep each student's progress organized without extra admin work.",
    openGraph: {
        title: "QR Attendance and Grading for Teachers",
        description:
            "Take attendance, save grades, and manage students from one clear teacher dashboard.",
        url: "/",
    },
    twitter: {
        title: "QR Attendance and Grading for Teachers",
        description:
            "Take attendance, save grades, and manage students from one clear teacher dashboard.",
    },
};

const heroProofPoints = [
    {
        title: "Live session control",
        detail: "Open attendance, watch check-ins arrive, and respond without losing the room.",
    },
    {
        title: "Import-ready grading",
        detail: "Bring in spreadsheet data quickly and keep coursework aligned with the same group workspace.",
    },
    {
        title: "Collaboration that stays clear",
        detail: "Professors and TAs share the same operational view instead of juggling side tools.",
    },
];

const featurePillars = [
    {
        icon: QrCode,
        title: "Run attendance without slowing the class",
        description:
            "Run rotating QR attendance with location-aware validation and live session control that stays readable under pressure.",
    },
    {
        icon: ClipboardCheck,
        title: "Keep grading tied to the same workflow",
        description:
            "Manage quizzes, assignments, practicals, midterms, and finals with spreadsheet imports, grading breakdowns, and clear review states.",
    },
    {
        icon: Building2,
        title: "Give departments a system they can trust",
        description:
            "Present a calmer, more consistent operating surface with clearer controls, safer workflows, and cleaner reporting moments.",
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

const trustPoints = [
    "Professor and TA friendly permissions",
    "Venue-aware attendance validation",
    "Exam and coursework flows in one workspace",
    "Export-ready records for follow-up and reporting",
];

export default async function LandingPage() {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const isLoggedIn = Boolean(session);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b border-white/20 bg-white/32 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl supports-backdrop-filter:bg-white/22">
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
                        {isLoggedIn ? (
                            <Button
                                asChild
                                className="shadow-[0_12px_28px_-18px_rgba(37,99,235,0.75)]"
                            >
                                <Link href="/dashboard">Open dashboard</Link>
                            </Button>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="transition-colors hover:text-primary"
                                >
                                    Sign in
                                </Link>
                                <Button
                                    asChild
                                    className="shadow-[0_12px_28px_-18px_rgba(37,99,235,0.75)]"
                                >
                                    <Link href="/register">Start free</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main>
                <section className="relative overflow-hidden border-b border-border/70">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(205,223,255,0.55),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(247,228,188,0.24),transparent_28%),linear-gradient(180deg,rgba(253,253,255,0.98),rgba(247,250,255,0.96))]" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                    <div className="relative mx-auto max-w-7xl px-6 py-18 lg:py-24">
                        <div className="mx-auto max-w-4xl text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground shadow-sm">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Built for instructors who need calm operational
                                control
                            </div>
                            <div className="mt-6 space-y-5">
                                <h1 className="font-display text-5xl leading-none text-foreground sm:text-6xl lg:text-7xl">
                                    Attendance, grading, and exam workflows in
                                    one teaching workspace.
                                </h1>
                                <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground">
                                    Quorum helps professors and TAs move from
                                    live attendance to coursework review and
                                    student follow-up without switching between
                                    scattered tools.
                                </p>
                            </div>
                            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
                                            <a href="mailto:sales@quorum.app">
                                                Book a demo
                                            </a>
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="mt-10 grid gap-3 text-left md:grid-cols-3">
                                {heroProofPoints.map((item) => (
                                    <div
                                        key={item.title}
                                        className="rounded-[24px] border border-border/70 bg-card/88 px-5 py-5 shadow-sm"
                                    >
                                        <div className="text-base font-semibold text-foreground">
                                            {item.title}
                                        </div>
                                        <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                            {item.detail}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative mx-auto mt-12 w-full max-w-5xl">
                            <div className="absolute inset-x-[12%] -top-8 h-24 rounded-[28px] bg-white/55 blur-2xl" />
                            <div className="relative overflow-hidden rounded-[34px] border border-border/70 bg-card shadow-[0_30px_80px_-48px_rgba(22,47,95,0.42)]">
                                <div className="border-b border-border/70 bg-background/82 px-4 py-4 sm:px-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">
                                                Quorum workspace
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Live attendance with coursework
                                                follow-through
                                            </div>
                                        </div>
                                        <Badge variant="success">
                                            Live session active
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,255,0.96))] p-4 sm:p-5 md:p-6">
                                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
                                        <div className="rounded-[26px] bg-primary px-4 py-5 text-primary-foreground shadow-[0_20px_50px_-32px_rgba(22,47,95,0.65)] sm:px-5">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                                                Live attendance
                                            </div>
                                            <div className="mt-3 text-xl font-semibold sm:text-2xl">
                                                CS102 • Lecture 05
                                            </div>
                                            <p className="mt-2 max-w-lg text-sm leading-6 text-primary-foreground/82">
                                                Projection-friendly QR, visible
                                                live status, and quick lecturer
                                                actions for the active classroom
                                                moment.
                                            </p>
                                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
                                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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
                                                            "Attendance included in the final blend",
                                                        ],
                                                        [
                                                            "Exam setup",
                                                            "Question groups reviewed and ready",
                                                        ],
                                                    ].map(([title, meta]) => (
                                                        <div
                                                            key={title}
                                                            className="rounded-[18px] border border-border/60 bg-card px-3 py-3"
                                                        >
                                                            <div className="text-sm font-medium text-foreground">
                                                                {title}
                                                            </div>
                                                            <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                                                {meta}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="rounded-[24px] border border-border/70 bg-background px-4 py-4">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                                    Team readiness
                                                </div>
                                                <div className="mt-3 grid gap-3">
                                                    {[
                                                        "TA onboarding stays simple",
                                                        "Student review stays attached to the same group record",
                                                        "Export-ready follow-up for departments",
                                                    ].map((item) => (
                                                        <div
                                                            key={item}
                                                            className="rounded-[18px] bg-primary/6 px-3 py-3 text-sm text-primary"
                                                        >
                                                            {item}
                                                        </div>
                                                    ))}
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
                                Core benefits
                            </div>
                            <h2 className="mt-4 font-display text-4xl text-foreground">
                                Built to make the next teaching action obvious.
                            </h2>
                            <p className="mt-4 text-lg leading-8 text-muted-foreground">
                                The product is designed for high-frequency
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
                    <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Operational flow
                            </div>
                            <h2 className="mt-4 text-4xl text-foreground">
                                Made for the way classes actually move.
                            </h2>
                            <p className="mt-4 text-lg leading-8 text-muted-foreground">
                                Quorum keeps the instructor workflow direct
                                while still giving departments a system that
                                looks organized, shareable, and easier to
                                evaluate.
                            </p>
                            <div className="mt-8 rounded-[28px] border border-border/70 bg-card px-5 py-6 shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                    Department support
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    {trustPoints.map((point) => (
                                        <div
                                            key={point}
                                            className="rounded-[20px] bg-primary/6 px-4 py-4 text-sm leading-6 text-primary"
                                        >
                                            {point}
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                <section className="py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="rounded-[34px] border border-border/70 bg-primary px-6 py-8 text-primary-foreground shadow-[0_26px_70px_-48px_rgba(22,47,95,0.5)] md:px-8">
                            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                                        Ready to evaluate
                                    </div>
                                    <h2 className="mt-4 font-display text-4xl text-primary-foreground">
                                        Move from classroom friction to a
                                        cleaner teaching workflow.
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-lg leading-8 text-primary-foreground/82">
                                        Start with one instructor or bring in a
                                        team. Quorum gives you a calmer
                                        operational surface now, with pricing
                                        details available as the rollout options
                                        finalize.
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
                                            className="rounded-[22px] border border-white/14 bg-white/10 px-4 py-4 text-sm text-primary-foreground/82"
                                        >
                                            <item.icon className="mb-3 h-4 w-4 text-primary-foreground" />
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
                                        variant="secondary"
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
                                        variant="secondary"
                                        className="rounded-full px-7"
                                    >
                                        <Link href="/register">Start free</Link>
                                    </Button>
                                )}
                                <Button
                                    asChild
                                    size="lg"
                                    variant="ghost"
                                    className="rounded-full px-7 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                                >
                                    <Link href="/pricing">
                                        See pricing updates
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
