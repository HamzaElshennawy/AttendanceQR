import type { Metadata } from "next";
import { AuthCardTransition } from "@/components/AuthCardTransition";
import { QuorumIcon } from "@/components/QuorumLogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Quorum",
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen items-center bg-[radial-gradient(circle_at_top_left,rgba(120,145,235,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(90,109,214,0.08),transparent_36%),linear-gradient(180deg,rgba(247,250,255,0.98),rgba(242,246,252,0.98))] px-4 py-10">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-10 rounded-[32px] border border-border/70 bg-background/70 px-4 py-8 shadow-[0_30px_80px_-46px_rgba(22,47,95,0.28)] backdrop-blur-xl lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,460px)] lg:px-6">
                <div className="hidden lg:block">
                    <div className="max-w-xl">
                        <div className="mb-5 inline-flex rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
                            Quorum Academic
                        </div>
                        <h1 className="font-display text-5xl leading-[1.02] text-foreground">
                            Academic operations that stay clear under pressure.
                        </h1>
                        <p className="mt-5 max-w-lg text-base leading-7 text-soft">
                            Sign in to manage attendance, coursework, live
                            sessions, and support workflows through the same
                            calm operational workspace.
                        </p>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-[24px] border border-border/70 bg-background/88 p-5">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Built for
                                </p>
                                <p className="mt-3 text-lg font-semibold text-foreground">
                                    Professors and TAs
                                </p>
                                <p className="mt-2 text-sm leading-6 text-soft">
                                    Manage groups, students, sessions, grading,
                                    and triage workflows from one system.
                                </p>
                            </div>
                            <div className="rounded-[24px] border border-border/70 bg-background/88 p-5">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    UX priority
                                </p>
                                <p className="mt-3 text-lg font-semibold text-foreground">
                                    Fast, low-friction tasks
                                </p>
                                <p className="mt-2 text-sm leading-6 text-soft">
                                    The experience is designed to reduce
                                    cognitive load in high-frequency academic
                                    operations.
                                </p>
                            </div>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            <span className="rounded-full border border-border/70 bg-background/88 px-3 py-2">
                                Attendance
                            </span>
                            <span className="rounded-full border border-border/70 bg-background/88 px-3 py-2">
                                Coursework
                            </span>
                            <span className="rounded-full border border-border/70 bg-background/88 px-3 py-2">
                                Exams
                            </span>
                            <span className="rounded-full border border-border/70 bg-background/88 px-3 py-2">
                                Team support
                            </span>
                        </div>
                    </div>
                </div>

                <div className="w-full">
                    <div className="mb-8 text-center lg:text-left">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_rgba(22,47,95,0.8)] lg:mx-0">
                            <QuorumIcon className="h-6 w-6" />
                        </div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                            Quorum
                        </h2>
                        <p className="mt-2 text-soft">
                            Academic operations workspace
                        </p>
                    </div>
                    <div className="rounded-[32px] border border-border/70 bg-background/88 p-2 shadow-[0_24px_70px_-44px_rgba(22,47,95,0.34)]">
                        <AuthCardTransition>{children}</AuthCardTransition>
                    </div>
                    <p className="mt-4 text-center text-sm text-soft lg:text-left">
                        Secure sign-in for teaching teams, grading workflows, and live attendance operations.
                    </p>
                </div>
            </div>
        </div>
    );
}
