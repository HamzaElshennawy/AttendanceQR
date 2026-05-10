"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const GROUP_TOUR_STATE_KEY = "quorum-group-workspace-tour";
const GROUP_TOUR_COMPLETED_KEY = "quorum-group-workspace-tour-completed";
const SPOTLIGHT_PADDING = 12;
const SPOTLIGHT_RADIUS = 32;
const CALLOUT_WIDTH = 380;
const CALLOUT_HEIGHT = 260;

type GroupTourTab = "sessions" | "coursework" | "students" | "team";
type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

type GroupOnboardingTutorialProps = {
    groupId: string;
    activeTab: GroupTourTab;
    onTabChange: (tab: GroupTourTab) => void;
};

type TourStep = {
    eyebrow: string;
    title: string;
    description: string;
    selector: string;
    placement: TourPlacement;
    tab?: GroupTourTab;
};

type SpotlightRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const groupSteps: TourStep[] = [
    {
        eyebrow: "Overview",
        title: "This group page becomes your course command center",
        description:
            "Use this workspace to manage students, sessions, coursework, and team access for one class or section.",
        selector: '[data-onboarding="group-overview"]',
        placement: "bottom",
    },
    {
        eyebrow: "Navigation",
        title: "These tabs split the work into clear zones",
        description:
            "Sessions handle live attendance, Coursework handles grades and assessments, Students manages the roster, and Team controls collaborators.",
        selector: '[data-onboarding="group-tabs"]',
        placement: "bottom",
    },
    {
        eyebrow: "Students",
        title: "Add or import students before you run live attendance",
        description:
            "This is where you build the roster, either by uploading a file or adding students one by one.",
        selector: '[data-onboarding="students-actions"]',
        placement: "bottom",
        tab: "students",
    },
    {
        eyebrow: "Coursework",
        title: "Coursework is where grades and assessments come together",
        description:
            "Use this area to manage assignments, exams, imports, grading workflows, and the academic record attached to this group.",
        selector: '[data-onboarding="coursework-panel"]',
        placement: "top",
        tab: "coursework",
    },
    {
        eyebrow: "Sessions",
        title: "Start sessions here when you are ready to take attendance",
        description:
            "Launch a live attendance session, choose duration, and configure options like rotating QR or location rules when needed.",
        selector: '[data-onboarding="sessions-actions"]',
        placement: "bottom",
        tab: "sessions",
    },
    {
        eyebrow: "Follow-up",
        title: "Post-session management happens in this area",
        description:
            "After sessions run, come back here to review attendance history, open past sessions, and manage the records after class ends.",
        selector: '[data-onboarding="sessions-history"]',
        placement: "top",
        tab: "sessions",
    },
] as const;

export function GroupOnboardingTutorial({
    groupId,
    activeTab,
    onTabChange,
}: GroupOnboardingTutorialProps) {
    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

    const step = groupSteps[currentStep];
    const isLastStep = currentStep === groupSteps.length - 1;

    useEffect(() => {
        let shouldOpen = false;
        let initialStep = 0;

        try {
            const completed = window.localStorage.getItem(
                GROUP_TOUR_COMPLETED_KEY,
            );
            const rawState = window.localStorage.getItem(GROUP_TOUR_STATE_KEY);
            const parsedState = rawState
                ? (JSON.parse(rawState) as { groupId?: string; step?: number })
                : null;

            if (
                parsedState?.groupId === groupId &&
                completed !== groupId
            ) {
                shouldOpen = true;
                initialStep = Math.min(
                    parsedState.step ?? 0,
                    groupSteps.length - 1,
                );
                window.localStorage.removeItem(GROUP_TOUR_STATE_KEY);
            }
        } catch {
            shouldOpen = false;
        }

        if (shouldOpen) {
            const timeoutId = window.setTimeout(() => {
                setCurrentStep(initialStep);
                setOpen(true);
            }, 150);

            return () => {
                window.clearTimeout(timeoutId);
            };
        }
    }, [groupId]);

    useEffect(() => {
        if (!open || !step.tab || activeTab === step.tab) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            onTabChange(step.tab!);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [activeTab, onTabChange, open, step]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const updateSpotlight = () => {
            const element = document.querySelector(step.selector);
            if (!(element instanceof HTMLElement)) {
                setSpotlightRect(null);
                return;
            }

            const rect = element.getBoundingClientRect();
            setSpotlightRect({
                top: rect.top - SPOTLIGHT_PADDING,
                left: rect.left - SPOTLIGHT_PADDING,
                width: rect.width + SPOTLIGHT_PADDING * 2,
                height: rect.height + SPOTLIGHT_PADDING * 2,
            });
        };

        const timeoutId = window.setTimeout(updateSpotlight, 120);
        const handle = () => window.requestAnimationFrame(updateSpotlight);
        window.addEventListener("resize", handle);
        window.addEventListener("scroll", handle, true);

        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener("resize", handle);
            window.removeEventListener("scroll", handle, true);
        };
    }, [open, step, activeTab]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    const markCompleted = () => {
        try {
            window.localStorage.setItem(GROUP_TOUR_COMPLETED_KEY, groupId);
            window.localStorage.removeItem(GROUP_TOUR_STATE_KEY);
        } catch {
            // Ignore storage failures and continue.
        }
    };

    const handleClose = () => {
        markCompleted();
        setOpen(false);
        setCurrentStep(0);
        setSpotlightRect(null);
    };

    const handleOpen = () => {
        setCurrentStep(0);
        setSpotlightRect(null);
        setOpen(true);
    };

    const cardStyle = useMemo(() => {
        if (!spotlightRect) {
            return {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            };
        }

        const gap = 18;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (step.placement === "bottom") {
            return {
                top: Math.min(
                    spotlightRect.top + spotlightRect.height + gap,
                    viewportHeight - CALLOUT_HEIGHT - 16,
                ),
                left: Math.min(
                    Math.max(spotlightRect.left + 8, 16),
                    viewportWidth - CALLOUT_WIDTH - 16,
                ),
            };
        }

        if (step.placement === "top") {
            return {
                top: Math.max(16, spotlightRect.top - CALLOUT_HEIGHT - gap),
                left: Math.min(
                    Math.max(spotlightRect.left + 8, 16),
                    viewportWidth - CALLOUT_WIDTH - 16,
                ),
            };
        }

        if (step.placement === "left") {
            return {
                top: Math.min(
                    Math.max(spotlightRect.top, 16),
                    viewportHeight - CALLOUT_HEIGHT - 16,
                ),
                left: Math.max(16, spotlightRect.left - CALLOUT_WIDTH - gap),
            };
        }

        if (step.placement === "right") {
            return {
                top: Math.min(
                    Math.max(spotlightRect.top, 16),
                    viewportHeight - CALLOUT_HEIGHT - 16,
                ),
                left: Math.min(
                    spotlightRect.left + spotlightRect.width + gap,
                    viewportWidth - CALLOUT_WIDTH - 16,
                ),
            };
        }

        return {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        };
    }, [spotlightRect, step.placement]);

    const pointerClassName = useMemo(() => {
        if (!spotlightRect) {
            return "";
        }

        if (step.placement === "top") {
            return "absolute -bottom-2 left-10 h-4 w-4 rotate-[225deg] border border-border/70 border-b-0 border-r-0 bg-background/97";
        }

        if (step.placement === "left") {
            return "absolute top-10 -right-2 h-4 w-4 rotate-[135deg] border border-border/70 border-b-0 border-r-0 bg-background/97";
        }

        if (step.placement === "right") {
            return "absolute top-10 -left-2 h-4 w-4 rotate-[-45deg] border border-border/70 border-b-0 border-r-0 bg-background/97";
        }

        return "absolute -top-2 left-10 h-4 w-4 rotate-45 border border-border/70 border-b-0 border-r-0 bg-background/97";
    }, [spotlightRect, step.placement]);

    const progressLabel = `${currentStep + 1} of ${groupSteps.length}`;

    return (
        <>
            <Button type="button" variant="outline" className="rounded-full" onClick={handleOpen}>
                Group tour
            </Button>

            {open ? (
                <div className="fixed inset-0 z-[90]">
                    {spotlightRect ? (
                        <>
                            <svg
                                className="pointer-events-none absolute inset-0 h-full w-full transition-all duration-300"
                                aria-hidden="true"
                            >
                                <defs>
                                    <mask id="group-tour-spotlight-mask">
                                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                        <rect
                                            x={spotlightRect.left}
                                            y={spotlightRect.top}
                                            width={spotlightRect.width}
                                            height={spotlightRect.height}
                                            rx={SPOTLIGHT_RADIUS}
                                            ry={SPOTLIGHT_RADIUS}
                                            fill="black"
                                        />
                                    </mask>
                                </defs>
                                <rect
                                    x="0"
                                    y="0"
                                    width="100%"
                                    height="100%"
                                    fill="rgba(15, 23, 42, 0.46)"
                                    mask="url(#group-tour-spotlight-mask)"
                                />
                            </svg>
                            <div
                                className="pointer-events-none absolute rounded-[2rem] border border-white/24"
                                style={{
                                    top: spotlightRect.top - 6,
                                    left: spotlightRect.left - 6,
                                    width: spotlightRect.width + 12,
                                    height: spotlightRect.height + 12,
                                }}
                            />
                            <div
                                className="pointer-events-none absolute rounded-[2rem] border border-primary/18"
                                style={{
                                    top: spotlightRect.top + 6,
                                    left: spotlightRect.left + 6,
                                    width: Math.max(spotlightRect.width - 12, 0),
                                    height: Math.max(spotlightRect.height - 12, 0),
                                }}
                            />
                        </>
                    ) : null}

                    <div
                        className="absolute z-[91] w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] border border-border/70 bg-background/97 p-5 text-foreground shadow-[0_32px_90px_-38px_rgba(15,23,42,0.65)]"
                        style={cardStyle}
                    >
                        {spotlightRect ? <div className={pointerClassName} /> : null}
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            {step.eyebrow}
                        </div>
                        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                            {progressLabel}
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                            {step.title}
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-soft">{step.description}</p>
                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-300"
                                style={{
                                    width: `${((currentStep + 1) / groupSteps.length) * 100}%`,
                                }}
                            />
                        </div>
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setCurrentStep((stepIndex) =>
                                            Math.max(0, stepIndex - 1),
                                        )
                                    }
                                    disabled={currentStep === 0}
                                >
                                    Back
                                </Button>
                                <Button type="button" variant="ghost" onClick={handleClose}>
                                    Skip
                                </Button>
                            </div>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (isLastStep) {
                                        handleClose();
                                        return;
                                    }
                                    setCurrentStep((stepIndex) =>
                                        Math.min(groupSteps.length - 1, stepIndex + 1),
                                    );
                                }}
                            >
                                {isLastStep ? "Finish" : "Next"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
