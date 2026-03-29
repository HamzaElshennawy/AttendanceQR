"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock3, ShieldAlert, CheckCircle2 } from "lucide-react";
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
    const [universityId, setUniversityId] = useState("");
    const [accessCode, setAccessCode] = useState("");
    const [attemptInfo, setAttemptInfo] = useState<{ attemptId: string; accessToken: string } | null>(null);
    const [attemptState, setAttemptState] = useState<AttemptState | null>(null);
    const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
    const [questionIndex, setQuestionIndex] = useState(0);
    const [now, setNow] = useState(0);
    const restoredRef = useRef(false);

    useEffect(() => {
        const loadFingerprint = async () => {
            try {
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                setFingerprint(result.visitorId);
            } catch {
                setFingerprint(`fallback_${Math.random().toString(36).slice(2)}`);
            }
        };

        void loadFingerprint();
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
                    setAttemptInfo({ attemptId: parsed.attemptId, accessToken: parsed.accessToken });
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
        async (attemptId: string, accessToken: string, logReconnect = false) => {
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
                    (data.answers || []).map((answer: AttemptState["answers"][number]) => [
                        answer.question_id,
                        {
                            answer_text: answer.answer_text || "",
                            selected_choice_ids: answer.selected_choice_ids || [],
                        },
                    ]),
                ),
            );
            setQuestionIndex(Math.max(0, Number(data.attempt.current_index || 0)));
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
        const res = await fetch(`/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "submit",
                access_token: attemptInfo.accessToken,
            }),
        });
        const data = await res.json();
        setSubmitting(false);

        if (!res.ok) {
            setMessage(data.error || "Failed to submit exam.");
            return;
        }

        await loadAttempt(attemptInfo.attemptId, attemptInfo.accessToken, false);
    }, [assessmentId, attemptInfo, loadAttempt]);

    useEffect(() => {
        if (!attemptInfo) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void loadAttempt(attemptInfo.attemptId, attemptInfo.accessToken, true);
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [attemptInfo, loadAttempt]);

    useEffect(() => {
        if (!attemptInfo) {
            return;
        }

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                void fetch(`/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`, {
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
                });
            }
        };

        const onBlur = () => {
            void fetch(`/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`, {
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
            });
        };

        const onBeforeUnload = () => {
            void fetch(`/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`, {
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
            });
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
    }, [assessmentId, attemptInfo?.accessToken, attemptState?.attempt.id, attemptState?.attempt.status, universityId]);

    useEffect(() => {
        if (attemptState?.attempt.status && attemptState.attempt.status !== "in_progress") {
            window.localStorage.removeItem(storageKey(assessmentId));
        }
    }, [assessmentId, attemptState?.attempt.status]);

    const remainingSeconds = !attemptState?.attempt.deadline_at
        ? 0
        : Math.max(
              0,
              Math.floor((new Date(attemptState.attempt.deadline_at).getTime() - now) / 1000),
          );

    useEffect(() => {
        if (attemptState?.attempt.status !== "in_progress" || remainingSeconds !== 0) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void handleSubmit();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [attemptState?.attempt.status, handleSubmit, remainingSeconds]);

    const currentQuestion = attemptState?.questions[questionIndex] || null;

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
            JSON.stringify({ ...nextAttempt, universityId: universityId.trim() }),
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
        await fetch(`/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`, {
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
        });
    };

    const goNext = async () => {
        if (!attemptState) {
            return;
        }

        const nextIndex = Math.min(questionIndex + 1, attemptState.questions.length - 1);
        setQuestionIndex(nextIndex);
        if (attemptInfo) {
            await fetch(`/api/exams/${assessmentId}/attempt/${attemptInfo.attemptId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "event",
                    access_token: attemptInfo.accessToken,
                    event_type: "autosaved",
                    current_index: nextIndex,
                    fingerprint,
                }),
            });
        }
    };

    const canGoBack =
        Boolean(attemptState) &&
        questionIndex > 0 &&
        !attemptState?.config?.no_backtracking;

    if (loadingMeta) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!meta) {
        return <div className="min-h-screen flex items-center justify-center text-gray-500">Exam not found.</div>;
    }

    if (!attemptState) {
        return (
            <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-xl shadow-lg border-0">
                    <CardHeader>
                        <CardTitle className="text-2xl text-gray-900">{meta.assessment.title}</CardTitle>
                        <p className="text-sm text-gray-500">{meta.config?.window_label || "Exam window unavailable"}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 flex flex-wrap gap-2">
                            <Badge variant="outline">{meta.question_count} questions</Badge>
                            <Badge variant="outline">{meta.config?.duration_minutes || 0} minutes</Badge>
                            <Badge variant="outline">Max {formatCourseworkScore(meta.assessment.max_score)}</Badge>
                        </div>
                        {!meta.access.ok ? (
                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {meta.access.message}
                            </div>
                        ) : null}
                        {message ? (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {message}
                            </div>
                        ) : null}
                        <form onSubmit={handleStart} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="universityId">University ID</Label>
                                <Input
                                    id="universityId"
                                    value={universityId}
                                    onChange={(event) => setUniversityId(event.target.value)}
                                    required
                                />
                            </div>
                            {meta.config?.requires_access_code ? (
                                <div className="space-y-2">
                                    <Label htmlFor="accessCode">Access Code</Label>
                                    <Input
                                        id="accessCode"
                                        value={accessCode}
                                        onChange={(event) => setAccessCode(event.target.value)}
                                    />
                                </div>
                            ) : null}
                            <Button type="submit" className="w-full" disabled={starting || !meta.access.ok}>
                                {starting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    "Start Exam"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loadingAttempt) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const finalized = attemptState.attempt.status !== "in_progress";

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            <div className="mx-auto max-w-5xl space-y-4">
                <div className="rounded-2xl border bg-white p-4 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{meta.assessment.title}</h1>
                            <p className="text-sm text-gray-500">
                                {attemptState.attempt.student_name} · {attemptState.attempt.university_id}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                                <Clock3 className="mr-1 h-3 w-3" />
                                {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
                            </Badge>
                            <Badge variant="outline">
                                Question {questionIndex + 1} / {attemptState.questions.length}
                            </Badge>
                            <Badge variant="outline">{attemptState.attempt.status}</Badge>
                        </div>
                    </div>
                    {message ? (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {message}
                        </div>
                    ) : null}
                    {attemptState.config?.one_question_at_a_time ? (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>One-question mode is enabled. Save your answer before moving on.</span>
                        </div>
                    ) : null}
                    {finalized ? (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                {attemptState.show_results
                                    ? `Attempt finished. Score ${formatCourseworkScore(attemptState.attempt.score || attemptState.attempt.auto_graded_score || 0)} / ${formatCourseworkScore(attemptState.attempt.max_score)}`
                                    : "Attempt finished. Results are not yet published."}
                            </span>
                        </div>
                    ) : null}
                </div>

                {currentQuestion ? (
                    <div className="rounded-2xl border bg-white p-4 md:p-6 space-y-4">
                        <div>
                            <div className="text-sm font-medium text-gray-500">Question {questionIndex + 1}</div>
                            <h2 className="mt-2 text-xl font-semibold text-gray-900">{currentQuestion.prompt}</h2>
                            {currentQuestion.description ? (
                                <p className="mt-2 text-sm text-gray-600">{currentQuestion.description}</p>
                            ) : null}
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                                {currentQuestion.points} points
                            </p>
                        </div>

                        {currentQuestion.question_type === "multiple_choice" ||
                        currentQuestion.question_type === "true_false" ? (
                            <div className="space-y-3">
                                {currentQuestion.choices.map((choice) => {
                                    const checked =
                                        answers[currentQuestion.id]?.selected_choice_ids?.includes(choice.id) || false;
                                    return (
                                        <label
                                            key={choice.id}
                                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
                                        >
                                            <input
                                                type="radio"
                                                name={currentQuestion.id}
                                                checked={checked}
                                                disabled={finalized}
                                                onChange={() =>
                                                    void saveAnswer(currentQuestion.id, {
                                                        answer_text: "",
                                                        selected_choice_ids: [choice.id],
                                                    })
                                                }
                                            />
                                            <span>{choice.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <textarea
                                value={answers[currentQuestion.id]?.answer_text || ""}
                                disabled={finalized}
                                onChange={(event) =>
                                    setAnswers((current) => ({
                                        ...current,
                                        [currentQuestion.id]: {
                                            answer_text: event.target.value,
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
                                className="min-h-48 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-xs"
                            />
                        )}

                        <div className="flex items-center justify-between gap-3 border-t pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!canGoBack || finalized}
                                onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
                            >
                                Previous
                            </Button>
                            <div className="flex gap-2">
                                {!finalized && questionIndex < attemptState.questions.length - 1 ? (
                                    <Button type="button" onClick={() => void goNext()}>
                                        Next
                                    </Button>
                                ) : null}
                                {!finalized ? (
                                    <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            "Submit Exam"
                                        )}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function ExamPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            }
        >
            <ExamPageInner />
        </Suspense>
    );
}

