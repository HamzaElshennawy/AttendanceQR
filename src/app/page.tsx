import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
    FileSpreadsheet,
    Fingerprint,
    MapPin,
    Search,
    ShieldCheck,
} from "lucide-react";
import { QuorumIcon } from "@/components/QuorumLogo";

export default async function LandingPage() {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const isLoggedIn = !!session;

    return (
        <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-zinc-200">
            {/* Navigation */}
            <nav className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2"
                    >
                        <div className="bg-zinc-900 p-1.5 rounded-md">
                            <QuorumIcon className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-zinc-900">
                            Quorum
                        </span>
                    </Link>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        {isLoggedIn ? (
                            <Link href="/dashboard">
                                <Button
                                    variant="default"
                                    className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full px-6"
                                >
                                    Dashboard
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="text-zinc-600 hover:text-zinc-900 transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link href="/register">
                                    <Button
                                        variant="default"
                                        className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full px-6"
                                    >
                                        Start Free
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative overflow-hidden border-b border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,250,250,0.92)_45%,_rgba(244,244,245,0.95)_100%)]">
                <div className="pointer-events-none absolute inset-0 opacity-60">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(24,24,27,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
                    <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-stone-200/50 blur-3xl" />
                    <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-100/50 blur-3xl" />
                    <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-amber-100/50 blur-3xl" />
                </div>

                <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 md:grid-cols-[0.95fr_1.05fr] md:items-center md:py-28">
                    <div className="max-w-xl text-left">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-600 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Attendance + Coursework LMS
                        </div>
                        <h1 className="text-5xl font-bold tracking-[-0.04em] text-zinc-950 md:text-7xl">
                            Built for classes,
                            <span className="block text-zinc-500">
                                sections, grades, and reports.
                            </span>
                        </h1>
                        <p className="mt-7 text-lg leading-8 text-zinc-600 md:text-xl">
                            Quorum combines rotating QR attendance, coursework
                            management, spreadsheet imports, historical
                            attendance uploads, and export-ready reporting in
                            one system for professors and TAs.
                        </p>

                        {/*<div className="mt-10 flex flex-col gap-4 sm:flex-row">*/}
                        {/*{isLoggedIn ? (
                                <Link href="/dashboard">
                                    <Button
                                        size="lg"
                                        className="h-12 rounded-full bg-zinc-950 px-8 text-base text-white hover:bg-zinc-800"
                                    >
                                        Enter Dashboard
                                    </Button>
                                </Link>
                            ) : (
                                <>
                                    <Link href="/register">
                                        <Button
                                            size="lg"
                                            className="h-12 rounded-full bg-zinc-950 px-8 text-base text-white hover:bg-zinc-800"
                                        >
                                            Launch Workspace
                                        </Button>
                                    </Link>
                                    <Link href="/login">
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="h-12 rounded-full border-zinc-300 bg-white/80 px-8 text-base text-zinc-700 hover:bg-zinc-50"
                                        >
                                            Sign In to Account
                                        </Button>
                                    </Link>
                                </>
                            )}*/}
                        {/*</div>*/}

                        <div className="mt-10 grid gap-4 sm:grid-cols-3">
                            {[
                                "QR attendance with anti-sharing protection",
                                "Coursework for quizzes, midterms, finals, and assignments",
                                "Excel exports with optional attendance totals",
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="rounded-2xl border border-zinc-200 bg-white/75 p-4 text-sm leading-6 text-zinc-600 shadow-sm backdrop-blur"
                                >
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative w-full">
                        <div className="absolute -left-6 top-12 hidden h-32 w-32 rounded-3xl border border-white/70 bg-white/60 blur-sm md:block" />
                        <div className="relative overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_25px_90px_rgba(24,24,27,0.12)]">
                            <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-900">
                                            Teaching Workspace
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            Live attendance and coursework
                                            overview
                                        </div>
                                    </div>
                                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                        Active
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] p-5">
                                <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                                    <div className="rounded-3xl bg-zinc-950 p-5 text-white">
                                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                                            Session
                                        </div>
                                        <div className="mt-3 text-2xl font-semibold">
                                            Lecture 05
                                        </div>
                                        <div className="mt-2 text-sm text-zinc-300">
                                            Rotating QR enabled with venue
                                            validation
                                        </div>
                                        <div className="mt-6 grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl bg-white/10 p-3">
                                                <div className="text-xs text-zinc-400">
                                                    Checked In
                                                </div>
                                                <div className="mt-1 text-xl font-semibold">
                                                    84
                                                </div>
                                            </div>
                                            <div className="rounded-2xl bg-white/10 p-3">
                                                <div className="text-xs text-zinc-400">
                                                    Late
                                                </div>
                                                <div className="mt-1 text-xl font-semibold">
                                                    7
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                                            Coursework
                                        </div>
                                        <div className="mt-3 space-y-3">
                                            {[
                                                ["Quiz 2", "32/40 graded"],
                                                [
                                                    "Midterm",
                                                    "Imported from Excel",
                                                ],
                                                [
                                                    "Attendance",
                                                    "Included in total",
                                                ],
                                            ].map(([title, meta]) => (
                                                <div
                                                    key={title}
                                                    className="rounded-2xl bg-zinc-50 p-3"
                                                >
                                                    <div className="text-sm font-medium text-zinc-900">
                                                        {title}
                                                    </div>
                                                    <div className="mt-1 text-xs text-zinc-500">
                                                        {meta}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-900">
                                                Import + Search Flow
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                One workspace for rosters,
                                                grades, and history
                                            </div>
                                        </div>
                                        <div className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500">
                                            Ctrl/Cmd + K
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {[
                                            ["Students", "Excel / CSV upload"],
                                            [
                                                "Attendance",
                                                "Past sessions import",
                                            ],
                                            [
                                                "Reports",
                                                "Coursework + attendance export",
                                            ],
                                        ].map(([title, desc]) => (
                                            <div
                                                key={title}
                                                className="rounded-2xl bg-zinc-50 p-3"
                                            >
                                                <div className="text-sm font-medium text-zinc-900">
                                                    {title}
                                                </div>
                                                <div className="mt-1 text-xs text-zinc-500">
                                                    {desc}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Security Features */}
            <section className="bg-white border-y border-zinc-200 py-24">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="mb-16 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                            Secure at the check-in layer
                        </h2>
                        <p className="text-zinc-500 mt-4 text-lg">
                            Attendance integrity is still enforced with rotating
                            QR tokens, venue-aware validation, and device
                            protection.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: QuorumIcon,
                                title: "Dynamic QR Code Rotation",
                                desc: "Check-in QR Codes refresh continuously. Capturing and sharing screenshots is rendered fundamentally useless.",
                            },
                            {
                                icon: MapPin,
                                title: "Geofenced Validation",
                                desc: "Strict location boundaries require attendees to be physically present in the designated venue to successfully authenticate.",
                            },
                            {
                                icon: Fingerprint,
                                title: "Device Fingerprinting",
                                desc: "Algorithmic hardware detection prevents identical physical devices from authenticating multiple profiles.",
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="flex flex-col items-center text-center"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6">
                                    <feature.icon className="h-5 w-5 text-zinc-900" />
                                </div>
                                <h3 className="text-xl font-semibold text-zinc-900 mb-3 tracking-tight">
                                    {feature.title}
                                </h3>
                                <p className="text-zinc-600 leading-relaxed text-sm">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Platform Features */}
            <section className="py-24 bg-[#fafafa]">
                <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                            Built for real academic workflow
                        </h2>
                        <p className="text-zinc-600 text-md leading-relaxed">
                            Beyond attendance sessions, Quorum now handles
                            coursework, historical imports, student tracking,
                            and export-ready reports for professors and TAs.
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Separate coursework space for quizzes, assignments, midterms, practicals, and finals",
                                "Excel and CSV imports for students, assessment grades, and historical attendance",
                                "Coursework export with optional cumulative attendance added to totals",
                                "Student search inside groups plus site-wide search across groups, sessions, and coursework",
                            ].map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3"
                                >
                                    <div className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                                    <span className="text-zinc-700 text-md">
                                        {item}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex-1 w-full bg-zinc-100 rounded-3xl border border-zinc-200 aspect-square flex items-center justify-center p-8 shadow-inner shadow-zinc-200/50">
                        <div className="w-full max-w-sm space-y-4">
                            {[
                                {
                                    icon: FileSpreadsheet,
                                    title: "Spreadsheet Imports",
                                    desc: "Roster, grades, and attendance history",
                                },
                                {
                                    icon: Search,
                                    title: "Fast Search",
                                    desc: "Groups, students, sessions, coursework",
                                },
                                {
                                    icon: ShieldCheck,
                                    title: "Unified Reports",
                                    desc: "Attendance and coursework exports",
                                },
                            ].map((item) => (
                                <div
                                    key={item.title}
                                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-4 shadow-sm"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100">
                                            <item.icon className="h-5 w-5 text-zinc-900" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm font-semibold text-zinc-900">
                                                {item.title}
                                            </div>
                                            <div className="text-sm text-zinc-500">
                                                {item.desc}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-zinc-200 py-12">
                <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-zinc-900 p-1 rounded-sm">
                            <QuorumIcon className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-zinc-900 tracking-tight">
                            Quorum
                        </span>
                    </div>
                    <p className="text-sm text-zinc-500">
                        &copy; {new Date().getFullYear()} Attendance Systems
                        infrastructure. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
