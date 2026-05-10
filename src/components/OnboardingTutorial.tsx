"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "quorum-onboarding-tour-completed";
const GROUP_TOUR_REQUEST_KEY = "quorum-onboarding-group-tour-requested";
const SPOTLIGHT_PADDING = 12;
const CALLOUT_WIDTH = 380;
const CALLOUT_HEIGHT = 260;
const SPOTLIGHT_RADIUS = 32;

type OnboardingTutorialProps = {
    groupsCount: number;
    onCreateGroup: () => void;
    onRequestGroupTour?: () => void;
};

type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

type TourStep = {
    eyebrow: string;
    title: string;
    description: string;
    selector: string;
    placement: TourPlacement;
    actionLabel?: string;
    action?: "create-group";
};

type SpotlightRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const desktopSteps: TourStep[] = [
    {
        eyebrow: "Overview",
        title: "This card summarizes your teaching footprint",
        description:
            "Start here when you want a quick read on groups, students, sessions, and the access you currently hold.",
        selector: '[data-onboarding="dashboard-overview"]',
        placement: "bottom",
    },
    {
        eyebrow: "Quick action",
        title: "Create your first group from here",
        description:
            "A group is the main workspace for one course, section, or lab. Most new users should begin with this action.",
        selector: '[data-onboarding="create-group-panel"]',
        placement: "left",
        actionLabel: "Create group now",
        action: "create-group",
    },
    {
        eyebrow: "Search",
        title: "Search becomes your fast navigation path later",
        description:
            "Once your workspace grows, use search to jump directly to groups, students, sessions, and coursework without digging through lists.",
        selector: '[data-onboarding="dashboard-search"]',
        placement: "bottom",
    },
    {
        eyebrow: "Workspace",
        title: "This area becomes your course command center",
        description:
            "If you have no groups yet, this space will prompt you to create one. After that, it turns into your list of teaching workspaces.",
        selector: '[data-onboarding="groups-area"]',
        placement: "top",
    },
];

export function OnboardingTutorial({
    groupsCount,
    onCreateGroup,
    onRequestGroupTour,
}: OnboardingTutorialProps) {
    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

    const steps = useMemo(() => desktopSteps, []);
    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    useEffect(() => {
        if (groupsCount > 0) {
            return;
        }

        let timeoutId: number | undefined;

        try {
            const completed = window.localStorage.getItem(STORAGE_KEY) === "true";
            if (!completed) {
                timeoutId = window.setTimeout(() => {
                    setOpen(true);
                }, 0);
            }
        } catch {
            timeoutId = window.setTimeout(() => {
                setOpen(true);
            }, 0);
        }

        return () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [groupsCount]);

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

        updateSpotlight();
        const handle = () => window.requestAnimationFrame(updateSpotlight);
        window.addEventListener("resize", handle);
        window.addEventListener("scroll", handle, true);

        return () => {
            window.removeEventListener("resize", handle);
            window.removeEventListener("scroll", handle, true);
        };
    }, [open, step]);

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
            window.localStorage.setItem(STORAGE_KEY, "true");
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

    const handlePrimaryAction = () => {
        if (step.action === "create-group") {
            try {
                window.localStorage.setItem(GROUP_TOUR_REQUEST_KEY, "true");
            } catch {
                // Ignore storage failures and continue.
            }
            onRequestGroupTour?.();
            setOpen(false);
            setSpotlightRect(null);
            onCreateGroup();
            return;
        }

        if (isLastStep) {
            handleClose();
            return;
        }

        setCurrentStep((stepIndex) => Math.min(steps.length - 1, stepIndex + 1));
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

    const progressLabel = `${currentStep + 1} of ${steps.length}`;
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

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={handleOpen}
            >
                Take tour
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
                                    <mask id="tour-spotlight-mask">
                                        <rect
                                            x="0"
                                            y="0"
                                            width="100%"
                                            height="100%"
                                            fill="white"
                                        />
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
                                    mask="url(#tour-spotlight-mask)"
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
                        className="absolute z-[91] w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] border border-border/70 bg-background/97 p-5 text-foreground shadow-[0_32px_90px_-38px_rgba(15,23,42,0.65)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
                        style={cardStyle}
                    >
                        {spotlightRect ? (
                            <div className={pointerClassName} />
                        ) : null}
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
                        <p className="mt-3 text-sm leading-7 text-soft">
                            {step.description}
                        </p>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-300"
                                style={{
                                    width: `${((currentStep + 1) / steps.length) * 100}%`,
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
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleClose}
                                >
                                    Skip
                                </Button>
                            </div>

                            <Button type="button" onClick={handlePrimaryAction}>
                                {step.actionLabel || (isLastStep ? "Finish" : "Next")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
