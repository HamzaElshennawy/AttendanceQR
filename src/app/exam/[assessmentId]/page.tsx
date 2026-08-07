"use client";

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { useParams } from "next/navigation";
import { getDeviceIdentity } from "@/lib/device-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Loader2,
    ShieldAlert,
} from "lucide-react";
import { formatCourseworkScore } from "@/lib/coursework";

type ExamMeta = {
    assessment: { id: string; title: string; max_score: number };
    config: {
        is_enabled: boolean;
        is_published: boolean;
        duration_minutes: number;
        max_attempts: number;
        start_at: string | null;
        end_at: string | null;
        requires_access_code: boolean;
        one_question_at_a_time: boolean;
        no_backtracking: boolean;
        show_results_immediately: boolean;
        window_label: string;
    } | null;
    access: { ok: boolean; message: string };
    question_count: number;
};

type AttemptState = {
    attempt: {
        id: string;
        status: string;
        student_name: string;
        university_id: string;
        deadline_at: string;
        started_at: string;
        current_index: number;
        score: number | null;
        auto_graded_score: number | null;
        max_score: number;
    };
    config: ExamMeta["config"];
    questions: Array<{
        id: string;
        prompt: string;
        description: string | null;
        question_type: string;
        points: number;
        position: number;
        is_required: boolean;
        choices: Array<{ id: string; label: string; position: number }>;
    }>;
    answers: Array<{
        question_id: string;
        answer_text: string | null;
        selected_choice_ids: string[];
        is_correct: boolean | null;
        awarded_points: number | null;
        needs_manual_review: boolean;
    }>;
    show_results: boolean;
};

type DraftAnswer = {
    answer_text: string;
    selected_choice_ids: string[];
};

const storageKey = (assessmentId: string) => `exam_attempt_${assessmentId}`;

function isAnswered(answer?: DraftAnswer) {
    return Boolean(
        answer &&
        (answer.answer_text.trim().length > 0 ||
            answer.selected_choice_ids.length > 0),
    );
}

function ExamPageInner() {
    const params = useParams();
    const assessmentId = params.assessmentId as string;
    const [meta, setMeta] = useState<ExamMeta | null>(null);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [starting, setStarting] = useState(false);
    const [loadingAttempt, setLoadingAttempt] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [fingerprint, setFingerprint] = useState("");
    const [deviceId, setDeviceId] = useState("");
    const [universityId, setUniversityId] = useState("");
    const [accessCode, setAccessCode] = useState("");
    const [attemptInfo, setAttemptInfo] = useState<{
        attemptId: string;
        accessToken: string;
    } | null>(null);
    const [attemptState, setAttemptState] = useState<AttemptState | null>(null);
    const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
    const [questionIndex, setQuestionIndex] = useState(0);
    const [now, setNow] = useState(0);
    const [reviewMode, setReviewMode] = useState(false);
    const restoredRef = useRef(false);

    useEffect(() => {
        const loadIdentity = async () => {
            const identity = await getDeviceIdentity();
            setFingerprint(identity.fingerprint);
            setDeviceId(identity.deviceId);
        };

        void loadIdentity();
    }, []);

    useEffect(() => {
        const loadMeta = async () => {
            setLoadingMeta(true);
            const res = await fetch(`/api/exams/${assessmentId}`);
            const data = await res.json();
            if (res.ok) {
                setMeta(data);
            } else {
                setMessage(data.error || "Failed to load exam.");
            }
            setLoadingMeta(false);
        };

        void loadMeta();
    }, [assessmentId]);

    useEffect(() => {
        if (!assessmentId || restoredRef.current) {
            return;
        }
        restoredRef.current = true;
        const saved = window.localStorage.getItem(storageKey(assessmentId));
        if (!saved) {
            return;
        }

        try {
            const parsed = JSON.parse(saved) as {
                attemptId: string;
                accessToken: string;
                universityId: string;
            };
            if (parsed.attemptId && parsed.accessToken) {
                const timeout = window.setTimeout(() => {
                    setUniversityId(parsed.universityId || "");
                    setAttemptInfo({
                        attemptId: parsed.attemptId,
                        accessToken: parsed.accessToken,
                    });
                }, 0);
                return () => window.clearTimeout(timeout);
            }
        } catch {
            window.localStorage.removeItem(storageKey(assessmentId));
        }
    }, [assessmentId]);

    useEffect(() => {
        if (!attemptState?.attempt.deadline_at) {
            return;
        }

        const timeout = window.setTimeout(() => setNow(Date.now()), 0);
        const handle = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearTimeout(timeout);
            window.clearInterval(handle);
        };
    }, [attemptState?.attempt.deadline_at]);

    const loadAttempt = useCallback(
        async (
            attemptId: string,
            accessToken: string,
            logReconnect = false,
        ) => {
            setLoadingAttempt(true);
            const res = await fetch(
                `/api/exams/${assessmentId}/attempt/${attemptId}?access_token=${encodeURIComponent(accessToken)}`,
            );
            const data = await res.json();
            if (!res.ok) {
                setMessage(data.error || "Failed to load attempt.");
                setLoadingAttempt(false);
                return;
            }

            setAttemptState(data);
            setAnswers(
                Object.fromEntries(
                    (data.answers || []).map(
                        (answer: AttemptState["answers"][number]) => [
                            answer.question_id,
                            {
                                answer_text: answer.answer_text || "",
                                selected_choice_ids:
                                    answer.selected_choice_ids || [],
                            },
                        ],
                    ),
                ),
            );
            setQuestionIndex(
                Math.max(0, Number(data.attempt.current_index || 0)),
            );
            setReviewMode(false);
            setLoadingAttempt(false);

            if (logReconnect) {
                void fetch(`/api/exams/${assessmentId}/attempt/${attemptId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "event",
                        access_token: accessToken,
                        event_type: "reconnected",
                        fingerprint,
                        current_index: data.attempt.current_index || 0,
                    }),
                });
            }
        },
        [assessmentId, fingerprint],
    );

    const handleSubmit = useCallback(async () => {
        if (!attemptInfo) {
            return;
        }

        setSubmitting(true);
        const res = await fetch(
            `/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "submit",
                    access_token: attemptInfo.accessToken,
                }),
            },
        );
        const data = await res.json();
        setSubmitting(false);

        if (!res.ok) {
            setMessage(data.error || "Failed to submit exam.");
            return;
        }

        await loadAttempt(
            attemptInfo.attemptId,
            attemptInfo.accessToken,
            false,
        );
    }, [assessmentId, attemptInfo, loadAttempt]);

    useEffect(() => {
        if (!attemptInfo) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void loadAttempt(
                attemptInfo.attemptId,
                attemptInfo.accessToken,
                true,
            );
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [attemptInfo, loadAttempt]);

    useEffect(() => {
        if (!attemptInfo) {
            return;
        }

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                void fetch(
                    `/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "event",
                            access_token: attemptInfo.accessToken,
                            event_type: "tab_hidden",
                            fingerprint,
                            current_index: questionIndex,
                        }),
                        keepalive: true,
                    },
                );
            }
        };

        const onBlur = () => {
            void fetch(
                `/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "event",
                        access_token: attemptInfo.accessToken,
                        event_type: "window_blur",
                        fingerprint,
                        current_index: questionIndex,
                    }),
                    keepalive: true,
                },
            );
        };

        const onBeforeUnload = () => {
            void fetch(
                `/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "event",
                        access_token: attemptInfo.accessToken,
                        event_type: "refresh",
                        fingerprint,
                        current_index: questionIndex,
                    }),
                    keepalive: true,
                },
            );
        };

        window.addEventListener("blur", onBlur);
        window.addEventListener("beforeunload", onBeforeUnload);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("beforeunload", onBeforeUnload);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [assessmentId, attemptInfo, fingerprint, questionIndex]);
    useEffect(() => {
        if (attemptState?.attempt.status !== "in_progress" || !assessmentId) {
            return;
        }
        window.localStorage.setItem(
            storageKey(assessmentId),
            JSON.stringify({
                attemptId: attemptState.attempt.id,
                accessToken: attemptInfo?.accessToken || "",
                universityId,
            }),
        );
    }, [
        assessmentId,
        attemptInfo?.accessToken,
        attemptState?.attempt.id,
        attemptState?.attempt.status,
        universityId,
    ]);

    useEffect(() => {
        if (
            attemptState?.attempt.status &&
            attemptState.attempt.status !== "in_progress"
        ) {
            window.localStorage.removeItem(storageKey(assessmentId));
        }
    }, [assessmentId, attemptState?.attempt.status]);

    const remainingSeconds = !attemptState?.attempt.deadline_at
        ? 0
        : Math.max(
              0,
              Math.floor(
                  (new Date(attemptState.attempt.deadline_at).getTime() - now) /
                      1000,
              ),
          );

    useEffect(() => {
        if (
            attemptState?.attempt.status !== "in_progress" ||
            remainingSeconds !== 0
        ) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void handleSubmit();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [attemptState?.attempt.status, handleSubmit, remainingSeconds]);

    const currentQuestion = attemptState?.questions[questionIndex] || null;
    const answeredCount = useMemo(
        () =>
            attemptState?.questions.filter((question) =>
                isAnswered(answers[question.id]),
            ).length || 0,
        [answers, attemptState?.questions],
    );
    const unansweredCount =
        (attemptState?.questions.length || 0) - answeredCount;
    const progressPercent = attemptState?.questions.length
        ? Math.round((answeredCount / attemptState.questions.length) * 100)
        : 0;
    const canJumpBetweenQuestions = Boolean(
        attemptState && !attemptState.config?.no_backtracking,
    );
    const reviewGroups = useMemo(() => {
        const groups: Array<{
            title: string;
            questions: AttemptState["questions"];
        }> = [];
        if (!attemptState) return groups;

        for (const question of attemptState.questions) {
            const title = question.description?.trim() || "General";
            const lastGroup = groups[groups.length - 1];
            if (!lastGroup || lastGroup.title !== title) {
                groups.push({ title, questions: [question] });
            } else {
                lastGroup.questions.push(question);
            }
        }

        return groups;
    }, [attemptState]);

    const handleStart = async (event: FormEvent) => {
        event.preventDefault();
        if (!universityId.trim()) {
            return;
        }

        setStarting(true);
        setMessage("");
        const res = await fetch(`/api/exams/${assessmentId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                university_id: universityId.trim(),
                access_code: accessCode.trim() || null,
                fingerprint,
                device_id: deviceId,
            }),
        });
        const data = await res.json();
        setStarting(false);

        if (!res.ok) {
            setMessage(data.error || "Failed to start exam.");
            return;
        }

        const nextAttempt = {
            attemptId: data.attempt_id as string,
            accessToken: data.access_token as string,
        };
        setAttemptInfo(nextAttempt);
        window.localStorage.setItem(
            storageKey(assessmentId),
            JSON.stringify({
                ...nextAttempt,
                universityId: universityId.trim(),
            }),
        );
    };

    const saveAnswer = async (
        questionId: string,
        nextValue: DraftAnswer,
        nextIndex = questionIndex,
    ) => {
        if (!attemptInfo) {
            return;
        }

        setAnswers((current) => ({ ...current, [questionId]: nextValue }));
        await fetch(
            `/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save",
                    access_token: attemptInfo.accessToken,
                    question_id: questionId,
                    answer_text: nextValue.answer_text,
                    selected_choice_ids: nextValue.selected_choice_ids,
                    current_index: nextIndex,
                }),
            },
        );
    };

    const goNext = async () => {
        if (!attemptState) {
            return;
        }

        const nextIndex = Math.min(
            questionIndex + 1,
            attemptState.questions.length - 1,
        );
        setQuestionIndex(nextIndex);
        if (attemptInfo) {
            await fetch(
                `/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "event",
                        access_token: attemptInfo.accessToken,
                        event_type: "autosaved",
                        current_index: nextIndex,
                        fingerprint,
                    }),
                },
            );
        }
    };

    const canGoBack =
        Boolean(attemptState) &&
        questionIndex > 0 &&
        !attemptState?.config?.no_backtracking;

    if (loadingMeta) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!meta) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4 text-muted-foreground">
                Exam not found.
            </div>
        );
    }

    if (!attemptState) {
        return (
            <div className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
                <div className="mx-auto max-w-5xl space-y-6">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        <span>Quorum assessment</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span className="text-primary">Student exam</span>
                    </div>
                    <section className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
                        <div className="rounded-[30px] border border-border/80 bg-card px-6 py-7 shadow-sm md:px-8">
                            <Badge
                                variant="outline"
                                className="bg-primary/6 text-primary"
                            >
                                Student exam access
                            </Badge>
                            <h1 className="mt-4 font-display text-4xl text-foreground">
                                {meta.assessment.title}
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Start the exam when you are ready. Once the
                                attempt begins, keep this page open and save
                                answers as you move through each question.
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Questions
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {meta.question_count}
                                    </div>
                                </div>
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Duration
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {meta.config?.duration_minutes || 0}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        minutes
                                    </p>
                                </div>
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Max score
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {formatCourseworkScore(
                                            meta.assessment.max_score,
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[30px] border border-border/80 bg-card px-6 py-7 shadow-sm">
                            <div className="text-sm text-muted-foreground">
                                Exam window
                            </div>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                                {meta.config?.window_label ||
                                    "Exam window unavailable"}
                            </p>

                            {!meta.access.ok ? (
                                <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                                    {meta.access.message}
                                </div>
                            ) : null}
                            {message ? (
                                <div className="mt-5 rounded-[22px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                    {message}
                                </div>
                            ) : null}

                            <form
                                onSubmit={handleStart}
                                className="mt-6 space-y-4"
                            >
                                <div className="space-y-2.5">
                                    <Label htmlFor="universityId">
                                        University ID
                                    </Label>
                                    <Input
                                        id="universityId"
                                        value={universityId}
                                        onChange={(event) =>
                                            setUniversityId(event.target.value)
                                        }
                                        required
                                    />
                                </div>
                                {meta.config?.requires_access_code ? (
                                    <div className="space-y-2.5">
                                        <Label htmlFor="accessCode">
                                            Access code
                                        </Label>
                                        <Input
                                            id="accessCode"
                                            value={accessCode}
                                            onChange={(event) =>
                                                setAccessCode(
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                ) : null}
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={starting || !meta.access.ok}
                                >
                                    {starting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Starting exam...
                                        </>
                                    ) : (
                                        "Start exam"
                                    )}
                                </Button>
                            </form>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    if (loadingAttempt) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const finalized = attemptState.attempt.status !== "in_progress";
    return (
        <div className="min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    <span>Quorum exam</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-primary">
                        {finalized
                            ? "Submission summary"
                            : reviewMode
                              ? "Review answers"
                              : "Question workspace"}
                    </span>
                </div>

                <section className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm md:px-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="space-y-3">
                            <Badge
                                variant="outline"
                                className="bg-primary/6 text-primary"
                            >
                                {finalized
                                    ? "Attempt finished"
                                    : "Exam in progress"}
                            </Badge>
                            <div>
                                <h1 className="font-display text-3xl text-foreground md:text-4xl">
                                    {meta.assessment.title}
                                </h1>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {attemptState.attempt.student_name} ·{" "}
                                    {attemptState.attempt.university_id}
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Time left
                                </div>
                                <div className="mt-3 text-2xl font-semibold text-foreground">
                                    {Math.floor(remainingSeconds / 60)}:
                                    {String(remainingSeconds % 60).padStart(
                                        2,
                                        "0",
                                    )}
                                </div>
                            </div>
                            <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                    Progress
                                </div>
                                <div className="mt-3 text-2xl font-semibold text-foreground">
                                    {answeredCount}/
                                    {attemptState.questions.length}
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    answered
                                </p>
                            </div>
                            <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                    Status
                                </div>
                                <div className="mt-3 text-lg font-semibold capitalize text-foreground">
                                    {attemptState.attempt.status.replace(
                                        "_",
                                        " ",
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                                <span>Answer progress</span>
                                <span>{progressPercent}% completed</span>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-primary/10">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                <span>{answeredCount} answered</span>
                                <span>{unansweredCount} unanswered</span>
                                <span>
                                    Autosave runs when you save or move forward
                                </span>
                            </div>
                        </div>
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">
                                Exam guidance
                            </div>
                            <div className="mt-3 space-y-2 leading-6">
                                <p>
                                    {attemptState.config?.one_question_at_a_time
                                        ? "One-question mode is enabled. Save your answer before moving forward."
                                        : "You can review your answers before the final submission step."}
                                </p>
                                <p>
                                    {attemptState.config?.no_backtracking
                                        ? "Backtracking is disabled after you move ahead."
                                        : "You can return to earlier questions until you submit."}
                                </p>
                                <p>
                                    {attemptState.config
                                        ?.show_results_immediately
                                        ? "Results may appear immediately after submission."
                                        : "Your submission will be recorded even if results are hidden for now."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {message ? (
                        <div className="mt-5 rounded-[22px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {message}
                        </div>
                    ) : null}
                    {attemptState.config?.one_question_at_a_time &&
                    !finalized ? (
                        <div className="mt-5 flex items-start gap-2 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                One-question mode is enabled. Save your answer
                                before moving on.
                            </span>
                        </div>
                    ) : null}
                </section>

                {finalized ? (
                    <section className="rounded-[30px] border border-border/80 bg-card px-6 py-8 shadow-sm md:px-8">
                        <div className="mx-auto max-w-3xl text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h2 className="mt-5 font-display text-4xl text-foreground">
                                Submission received
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Your attempt has been recorded successfully. You
                                can close this page now.
                            </p>
                            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Answered
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {answeredCount}
                                    </div>
                                </div>
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Final status
                                    </div>
                                    <div className="mt-3 text-lg font-semibold capitalize text-foreground">
                                        {attemptState.attempt.status.replace(
                                            "_",
                                            " ",
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Score
                                    </div>
                                    <div className="mt-3 text-lg font-semibold text-foreground">
                                        {attemptState.show_results
                                            ? `${formatCourseworkScore(attemptState.attempt.score || attemptState.attempt.auto_graded_score || 0)} / ${formatCourseworkScore(attemptState.attempt.max_score)}`
                                            : "Pending release"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : reviewMode ? (
                    <section className="grid gap-5 lg:grid-cols-[1.25fr_0.95fr]">
                        <div className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm md:px-8">
                            <Badge
                                variant="outline"
                                className="bg-primary/6 text-primary"
                            >
                                Review answers
                            </Badge>
                            <h2 className="mt-4 font-display text-3xl text-foreground">
                                Final check before submit
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Review answer coverage and return to any
                                question you still want to update.
                            </p>
                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Answered
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {answeredCount}
                                    </div>
                                </div>
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Unanswered
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {unansweredCount}
                                    </div>
                                </div>
                                <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Total questions
                                    </div>
                                    <div className="mt-3 text-3xl font-semibold text-foreground">
                                        {attemptState.questions.length}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 space-y-5">
                                {reviewGroups.map((group) => (
                                    <div
                                        key={group.title}
                                        className="space-y-3"
                                    >
                                        <div className="rounded-[18px] border border-border/70 bg-primary/5 px-4 py-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                                Question group
                                            </div>
                                            <div className="mt-1 font-medium text-foreground">
                                                {group.title}
                                            </div>
                                        </div>
                                        {group.questions.map((question) => {
                                            const index =
                                                attemptState.questions.findIndex(
                                                    (item) =>
                                                        item.id === question.id,
                                                );
                                            const answered = isAnswered(
                                                answers[question.id],
                                            );
                                            return (
                                                <div
                                                    key={question.id}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-border/80 bg-background px-4 py-4"
                                                >
                                                    <div>
                                                        <div className="text-sm font-medium text-foreground">
                                                            Question {index + 1}
                                                        </div>
                                                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                                                            {question.prompt}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            variant={
                                                                answered
                                                                    ? "success"
                                                                    : "outline"
                                                            }
                                                        >
                                                            {answered
                                                                ? "Answered"
                                                                : "Unanswered"}
                                                        </Badge>
                                                        {canJumpBetweenQuestions ? (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setQuestionIndex(
                                                                        index,
                                                                    );
                                                                    setReviewMode(
                                                                        false,
                                                                    );
                                                                }}
                                                            >
                                                                Open
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Ready to submit
                            </div>
                            <h3 className="mt-3 font-display text-2xl text-foreground">
                                Finish with confidence
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Once submitted, this attempt is locked. Make
                                sure your remaining unanswered questions are
                                intentional.
                            </p>
                            {unansweredCount > 0 ? (
                                <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            {unansweredCount} question
                                            {unansweredCount === 1
                                                ? " is"
                                                : "s are"}{" "}
                                            still unanswered.
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            <div className="mt-6 space-y-3">
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={() => void handleSubmit()}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Submitting exam...
                                        </>
                                    ) : (
                                        "Submit exam"
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setReviewMode(false)}
                                >
                                    Return to questions
                                </Button>
                            </div>
                        </div>
                    </section>
                ) : currentQuestion ? (
                    <section className="grid gap-5 lg:grid-cols-[1.45fr_0.92fr]">
                        <div className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm md:px-8">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Question {questionIndex + 1} of{" "}
                                        {attemptState.questions.length}
                                    </div>
                                    {currentQuestion.description ? (
                                        <Badge
                                            variant="outline"
                                            className="mt-3 bg-primary/6 text-primary"
                                        >
                                            {currentQuestion.description}
                                        </Badge>
                                    ) : null}
                                    <h2 className="mt-3 font-display text-3xl text-foreground">
                                        {currentQuestion.prompt}
                                    </h2>
                                </div>
                                <Badge variant="outline">
                                    {currentQuestion.points} points
                                </Badge>
                            </div>

                            <div className="mt-6 space-y-3">
                                {currentQuestion.question_type ===
                                    "multiple_choice" ||
                                currentQuestion.question_type ===
                                    "true_false" ? (
                                    currentQuestion.choices.map((choice) => {
                                        const checked =
                                            answers[
                                                currentQuestion.id
                                            ]?.selected_choice_ids?.includes(
                                                choice.id,
                                            ) || false;
                                        return (
                                            <label
                                                key={choice.id}
                                                className={`flex cursor-pointer items-center gap-3 rounded-[22px] border px-4 py-4 text-sm transition-colors ${checked ? "border-primary/30 bg-primary/8 text-foreground" : "border-border/80 bg-background text-foreground hover:border-primary/20 hover:bg-primary/5"}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={currentQuestion.id}
                                                    checked={checked}
                                                    disabled={finalized}
                                                    onChange={() =>
                                                        void saveAnswer(
                                                            currentQuestion.id,
                                                            {
                                                                answer_text: "",
                                                                selected_choice_ids:
                                                                    [choice.id],
                                                            },
                                                        )
                                                    }
                                                />
                                                <span>{choice.label}</span>
                                            </label>
                                        );
                                    })
                                ) : (
                                    <textarea
                                        title="Answer"
                                        value={
                                            answers[currentQuestion.id]
                                                ?.answer_text || ""
                                        }
                                        disabled={finalized}
                                        onChange={(event) =>
                                            setAnswers((current) => ({
                                                ...current,
                                                [currentQuestion.id]: {
                                                    answer_text:
                                                        event.target.value,
                                                    selected_choice_ids: [],
                                                },
                                            }))
                                        }
                                        onBlur={() =>
                                            void saveAnswer(
                                                currentQuestion.id,
                                                answers[currentQuestion.id] || {
                                                    answer_text: "",
                                                    selected_choice_ids: [],
                                                },
                                            )
                                        }
                                        className="min-h-64 w-full rounded-[24px] border border-input bg-background px-4 py-4 text-sm shadow-xs outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10"
                                    />
                                )}
                            </div>

                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!canGoBack || finalized}
                                    onClick={() =>
                                        setQuestionIndex((current) =>
                                            Math.max(0, current - 1),
                                        )
                                    }
                                >
                                    Previous
                                </Button>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setReviewMode(true)}
                                    >
                                        Review answers
                                    </Button>
                                    {questionIndex <
                                    attemptState.questions.length - 1 ? (
                                        <Button
                                            type="button"
                                            onClick={() => void goNext()}
                                            disabled={finalized}
                                        >
                                            Next
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            onClick={() => setReviewMode(true)}
                                            disabled={finalized}
                                        >
                                            Go to final review
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                    Autosave assurance
                                </div>
                                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                    Multiple choice answers save immediately.
                                    Written responses save when you move away
                                    from the field or continue to the next step.
                                </p>
                            </div>
                            <div className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                    Question list
                                </div>
                                <div className="mt-4 grid grid-cols-5 gap-2">
                                    {attemptState.questions.map(
                                        (question, index) => {
                                            const answered = isAnswered(
                                                answers[question.id],
                                            );
                                            const active =
                                                index === questionIndex;
                                            return (
                                                <button
                                                    key={question.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (
                                                            canJumpBetweenQuestions
                                                        )
                                                            setQuestionIndex(
                                                                index,
                                                            );
                                                    }}
                                                    disabled={
                                                        !canJumpBetweenQuestions
                                                    }
                                                    className={`rounded-2xl border px-0 py-3 text-sm font-medium transition-colors ${active ? "border-primary/30 bg-primary/10 text-primary" : answered ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border/80 bg-background text-muted-foreground"} ${canJumpBetweenQuestions ? "hover:border-primary/20 hover:bg-primary/5" : "cursor-default"}`}
                                                >
                                                    {index + 1}
                                                </button>
                                            );
                                        },
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}

export default function ExamPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <ExamPageInner />
        </Suspense>
    );
}
