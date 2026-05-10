"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, Lightbulb, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "quorum-feedback-prompt";
const INITIAL_DELAY_MS = 45_000;
const REMINDER_INTERVAL_MS = 45 * 60 * 1000;
const SNOOZE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const POST_FEEDBACK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

type PromptState = {
    nextEligibleAt?: number;
};

const hiddenPaths = new Set([
    "/dashboard/feedback",
    "/dashboard/admin/feedback",
]);

function readPromptState(): PromptState {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as PromptState;
    } catch {
        return {};
    }
}

function writePromptState(state: PromptState) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage failures so the prompt still works in restricted browsers.
    }
}

export function FeedbackPrompt() {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const isHiddenPath = hiddenPaths.has(pathname);

    useEffect(() => {
        if (isHiddenPath) {
            const hideTimeoutId = window.setTimeout(() => {
                setIsVisible(false);
            }, 0);
            return () => window.clearTimeout(hideTimeoutId);
        }

        if (isVisible) {
            return;
        }

        let timeoutId: number | undefined;

        const schedulePrompt = () => {
            const state = readPromptState();
            const now = Date.now();
            const nextEligibleAt = state.nextEligibleAt ?? 0;

            if (now >= nextEligibleAt) {
                timeoutId = window.setTimeout(() => {
                    setIsVisible(true);
                    writePromptState({
                        nextEligibleAt: Date.now() + REMINDER_INTERVAL_MS,
                    });
                }, INITIAL_DELAY_MS);
                return;
            }

            const waitTime = Math.max(nextEligibleAt - now, 60_000);
            timeoutId = window.setTimeout(() => {
                schedulePrompt();
            }, waitTime);
        };

        schedulePrompt();

        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            if (isVisible) return;

            const state = readPromptState();
            if (Date.now() >= (state.nextEligibleAt ?? 0)) {
                setIsVisible(true);
                writePromptState({
                    nextEligibleAt: Date.now() + REMINDER_INTERVAL_MS,
                });
            }
        }, 60_000);

        return () => {
            if (timeoutId) window.clearTimeout(timeoutId);
            window.clearInterval(intervalId);
        };
    }, [isHiddenPath, isVisible]);

    if (isHiddenPath || !isVisible) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(32rem,calc(100vw-2rem))] sm:right-6 sm:bottom-6">
            <div className="pointer-events-auto overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(239,244,255,0.94))] text-foreground shadow-[0_24px_60px_-32px_rgba(31,41,55,0.42)] backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:zoom-in-95 motion-safe:duration-400">
                <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
                    <div className="min-w-0 flex-1">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            Help improve Quorum
                        </div>
                        <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                            Have feedback, a bug report, or a suggestion?
                        </h3>
                        <p className="mt-1.5 max-w-[40ch] text-sm leading-5 text-soft">
                            Tell us what is working, what is frustrating, or
                            what you want us to build next.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Dismiss feedback prompt"
                        onClick={() => {
                            writePromptState({
                                nextEligibleAt: Date.now() + SNOOZE_INTERVAL_MS,
                            });
                            setIsVisible(false);
                        }}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 pb-3">
                    <div className="flex flex-wrap gap-2 text-xs text-subtle">
                        <div className="flex items-center gap-2 rounded-2xl bg-background/72 px-3 py-2">
                            <MessageSquarePlus className="h-3.5 w-3.5 text-primary" />
                            Feedback
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl bg-background/72 px-3 py-2">
                            <Bug className="h-3.5 w-3.5 text-primary" />
                            Bug report
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl bg-background/72 px-3 py-2">
                            <Lightbulb className="h-3.5 w-3.5 text-primary" />
                            Suggestion
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-background/55 px-5 py-3.5">
                    <Button
                        type="button"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => {
                            writePromptState({
                                nextEligibleAt: Date.now() + SNOOZE_INTERVAL_MS,
                            });
                            setIsVisible(false);
                        }}
                    >
                        Later
                    </Button>
                    <Button
                        asChild
                        className="rounded-xl"
                    >
                        <Link
                            href="/dashboard/feedback"
                            onClick={() => {
                                writePromptState({
                                    nextEligibleAt:
                                        Date.now() + POST_FEEDBACK_INTERVAL_MS,
                                });
                                setIsVisible(false);
                            }}
                        >
                            Give feedback
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
