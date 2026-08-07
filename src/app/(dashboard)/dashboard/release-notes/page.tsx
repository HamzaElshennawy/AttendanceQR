import { Badge } from "@/components/ui/badge";
import { releaseNotes } from "@/lib/release-notes";
import { CalendarDays } from "lucide-react";

const latestRelease = releaseNotes[0];
const totalEntries = releaseNotes.reduce(
    (sum, release) => sum + release.notes.length,
    0,
);
const uniqueTags = new Set(releaseNotes.map((release) => release.tag)).size;

function getTagClass(tag: string) {
    switch (tag) {
        case "Latest":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "Security":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "Attendance":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "Grading":
            return "border-violet-200 bg-violet-50 text-violet-700";
        case "Workflow":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "Launch":
            return "border-slate-200 bg-slate-50 text-slate-700";
        default:
            return "border-primary/20 bg-primary/5 text-primary";
    }
}

export default function ReleaseNotesPage() {
    return (
        <div className="space-y-6">
            <section className="grid gap-5 ">
                {/*xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.9fr)]*/}
                <div className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] shadow-[0_24px_60px_-42px_rgba(22,47,95,0.28)]">
                    <div className="border-b border-border/60 px-6 py-5 sm:px-7">
                        <Badge className="rounded-full border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/8">
                            Product updates
                        </Badge>
                        <h1 className="mt-4 font-display text-[2rem] leading-tight text-foreground">
                            Release notes
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-soft">
                            A structured log of what changed in Quorum, written
                            for faster scanning by instructors, TAs, and product
                            reviewers.
                        </p>
                    </div>

                    <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-7 xl:grid-cols-3">
                        <div className="min-h-[160px] rounded-[24px] border border-border/70 bg-background/90 px-5 py-5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Current release
                            </p>
                            <p className="mt-5 text-[1.9rem] font-semibold tracking-tight text-foreground">
                                {latestRelease?.version ?? "—"}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-soft">
                                Latest published update in the current release
                                ledger.
                            </p>
                        </div>
                        <div className="min-h-[160px] rounded-[24px] border border-border/70 bg-background/90 px-5 py-5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Logged changes
                            </p>
                            <p className="mt-5 text-[1.9rem] font-semibold tracking-tight text-foreground">
                                {totalEntries}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-soft">
                                Individual notes captured across the release
                                history.
                            </p>
                        </div>
                        <div className="min-h-[160px] rounded-[24px] border border-border/70 bg-background/90 px-5 py-5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Release themes
                            </p>
                            <p className="mt-5 text-[1.9rem] font-semibold tracking-tight text-foreground">
                                {uniqueTags}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-soft">
                                Areas like grading, attendance, workflow, and
                                security represented in the changelog.
                            </p>
                        </div>
                    </div>
                </div>
                {/*<div className="rounded-[28px] border border-border/70 bg-background/96 p-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                    <Badge
                        variant="warning"
                        className="rounded-full px-3 py-1 text-[0.68rem] tracking-[0.18em]"
                    >
                        Reading guide
                    </Badge>
                    <h2 className="mt-4 text-xl font-semibold text-foreground">
                        What this page focuses on
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-soft">
                        This view is intentionally limited to release
                        communication. Feedback submission and triage stay in
                        their own dedicated workflow.
                    </p>

                    <div className="mt-5 space-y-3">
                        <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Latest-first scanning
                            </div>
                            <p className="mt-2 text-sm leading-6 text-soft">
                                The newest product update is always first so
                                teams can quickly see what changed most recently.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Layers3 className="h-4 w-4 text-primary" />
                                Theme-based tagging
                            </div>
                            <p className="mt-2 text-sm leading-6 text-soft">
                                Each release is labeled by its primary area so
                                readers can spot grading, attendance, workflow,
                                or security changes more easily.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Clock3 className="h-4 w-4 text-primary" />
                                Handoff-friendly notes
                            </div>
                            <p className="mt-2 text-sm leading-6 text-soft">
                                Notes are phrased for internal product review,
                                QA handoff, and teammate context sharing.
                            </p>
                        </div>
                    </div>
                </div>*/}
            </section>

            <section className="space-y-4">
                {releaseNotes.map((release, index) => (
                    <article
                        key={release.version}
                        className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)]"
                    >
                        <div className="hidden lg:flex lg:flex-col lg:items-start">
                            <div className="rounded-[22px] border border-border/70 bg-background/90 px-4 py-4 shadow-sm">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Release
                                </p>
                                <p className="mt-3 text-lg font-semibold text-foreground">
                                    {release.version}
                                </p>
                                <div className="mt-3 flex items-center gap-2 text-sm text-soft">
                                    <CalendarDays className="h-4 w-4" />
                                    <span>{release.date}</span>
                                </div>
                            </div>
                            {index !== releaseNotes.length - 1 ? (
                                <div className="ml-11 h-full w-px bg-border/70" />
                            ) : null}
                        </div>

                        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background/96 shadow-[0_20px_56px_-42px_rgba(22,47,95,0.18)]">
                            <div className="border-b border-border/60 px-6 py-5 sm:px-7">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground lg:hidden">
                                                {release.version}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={getTagClass(
                                                    release.tag,
                                                )}
                                            >
                                                {release.tag}
                                            </Badge>
                                            <span className="text-sm text-soft lg:hidden">
                                                {release.date}
                                            </span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
                                                {release.title}
                                            </h2>
                                            <p className="mt-2 text-sm leading-6 text-soft">
                                                {release.notes.length} update
                                                {release.notes.length === 1
                                                    ? ""
                                                    : "s"}{" "}
                                                included in this release.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-6 sm:px-7">
                                <ul className="space-y-3">
                                    {release.notes.map((note) => (
                                        <li
                                            key={note}
                                            className="flex items-start gap-3 rounded-[20px] border border-border/70 bg-transparent px-4 py-4"
                                        >
                                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                            <span className="text-sm leading-6 text-foreground/88">
                                                {note}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}
