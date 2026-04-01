"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    examQuestionTypeOptions,
    formatAttemptScore,
    formatExamQuestionType,
    formatExamWindow,
    getDefaultChoicesForQuestionType,
    normalizeExamConfig,
    normalizeExamQuestion,
    normalizeQuestionChoice,
    type AssessmentAttempt,
    type AssessmentExamConfig,
    type AssessmentQuestion,
    type QuestionChoice,
} from "@/lib/exams";
import type { CourseworkAssessment } from "@/lib/coursework";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAppDialog } from "@/components/AppDialogProvider";
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    ExternalLink,
    Loader2,
    Lock,
    Plus,
    Save,
    Shield,
    Trash2,
} from "lucide-react";

function boolValue(value: boolean) {
    return value ? "yes" : "no";
}

interface QuestionDraft extends AssessmentQuestion {
    choices: QuestionChoice[];
}

const toggleSettingFields: Array<{
    field: keyof AssessmentExamConfig;
    label: string;
    description: string;
    risk?: boolean;
}> = [
    {
        field: "shuffle_questions",
        label: "Shuffle questions",
        description: "Reduce copying by varying question order per attempt.",
    },
    {
        field: "shuffle_choices",
        label: "Shuffle choices",
        description: "Randomize answer option order for objective questions.",
    },
    {
        field: "one_question_at_a_time",
        label: "One-question mode",
        description: "Keep students focused on one prompt at a time.",
    },
    {
        field: "no_backtracking",
        label: "No backtracking",
        description:
            "Students cannot return to earlier questions after moving on.",
        risk: true,
    },
    {
        field: "show_results_immediately",
        label: "Show results immediately",
        description:
            "Reveal scores as soon as submission completes when possible.",
    },
    {
        field: "require_session_attendance",
        label: "Require attendance",
        description:
            "Limit exam access to students marked present for the session.",
    },
];

export function ExamSetupEditor({
    assessment,
    onSaved,
}: {
    assessment: CourseworkAssessment | null;
    onSaved: () => void | Promise<void>;
}) {
    const supabase = createClient();
    const { showAlert } = useAppDialog();
    const [loading, setLoading] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [savingQuestions, setSavingQuestions] = useState(false);
    const [config, setConfig] = useState<AssessmentExamConfig | null>(null);
    const [questions, setQuestions] = useState<QuestionDraft[]>([]);
    const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
    const [statusMessage, setStatusMessage] = useState("");

    const loadEditor = useCallback(async () => {
        if (!assessment) {
            setConfig(null);
            setQuestions([]);
            setAttempts([]);
            setStatusMessage("");
            return;
        }

        setLoading(true);
        const [configRes, questionsRes, attemptsRes] = await Promise.all([
            supabase
                .from("assessment_exam_configs")
                .select("*")
                .eq("assessment_id", assessment.id)
                .maybeSingle(),
            supabase
                .from("assessment_questions")
                .select(
                    "id, assessment_id, prompt, description, question_type, points, position, is_required, is_published, answer_text, choices:question_choices(id, question_id, label, position, is_correct)",
                )
                .eq("assessment_id", assessment.id)
                .order("position", { ascending: true }),
            supabase
                .from("assessment_attempts")
                .select(
                    "id, assessment_id, student_id, university_id, student_name, status, attempt_number, started_at, deadline_at, submitted_at, last_seen_at, current_index, access_token, question_order, choice_order, device_fingerprint, score, max_score, auto_graded_score",
                )
                .eq("assessment_id", assessment.id)
                .order("started_at", { ascending: false }),
        ]);

        setConfig(
            normalizeExamConfig({
                assessment_id: assessment.id,
                group_id: assessment.group_id,
                ...(configRes.data || {}),
            }),
        );
        setQuestions(
            (
                (questionsRes.data || []) as Array<
                    AssessmentQuestion & {
                        choices?: QuestionChoice[] | QuestionChoice[][];
                    }
                >
            ).map((question, index) => {
                const normalizedQuestion = normalizeExamQuestion(
                    question,
                    index,
                );
                const rawChoices = Array.isArray(question.choices)
                    ? question.choices.flatMap((choice) =>
                          Array.isArray(choice) ? choice : [choice],
                      )
                    : [];
                const normalizedChoices = rawChoices.map(
                    (choice, choiceIndex) =>
                        normalizeQuestionChoice(
                            choice,
                            normalizedQuestion.id,
                            choiceIndex,
                        ),
                );

                return {
                    ...normalizedQuestion,
                    choices:
                        normalizedChoices.length > 0
                            ? normalizedChoices
                            : getDefaultChoicesForQuestionType(
                                  normalizedQuestion.question_type,
                              ).map((choice, choiceIndex) =>
                                  normalizeQuestionChoice(
                                      choice,
                                      normalizedQuestion.id,
                                      choiceIndex,
                                  ),
                              ),
                };
            }),
        );
        setAttempts((attemptsRes.data || []) as AssessmentAttempt[]);
        setLoading(false);
    }, [assessment, supabase]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void loadEditor();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [loadEditor]);

    const questionCount = questions.length;
    const totalPoints = useMemo(
        () =>
            questions.reduce(
                (sum, question) => sum + Number(question.points || 0),
                0,
            ),
        [questions],
    );
    const publishedQuestionCount = useMemo(
        () => questions.filter((question) => question.is_published).length,
        [questions],
    );
    const hasAttempts = attempts.length > 0;
    const examUrl =
        assessment && typeof window !== "undefined"
            ? `${window.location.origin}/exam/${assessment.id}`
            : "";
    const objectiveQuestionCount = useMemo(
        () =>
            questions.filter(
                (question) =>
                    question.question_type === "multiple_choice" ||
                    question.question_type === "true_false",
            ).length,
        [questions],
    );
    const manualReviewCount = questionCount - objectiveQuestionCount;
    const launchSignals = useMemo(() => {
        if (!config) {
            return [] as string[];
        }

        const signals: string[] = [];
        if (!config.is_enabled)
            signals.push("Exam access is currently disabled.");
        if (!config.is_published)
            signals.push(
                "Students will not see the exam until it is published.",
            );
        if (questionCount === 0)
            signals.push("Add at least one question before launch.");
        if (
            config.start_at &&
            config.end_at &&
            new Date(config.start_at) >= new Date(config.end_at)
        ) {
            signals.push("End time must be later than start time.");
        }
        return signals;
    }, [config, questionCount]);
    const riskSettings = useMemo(() => {
        if (!config) {
            return [] as string[];
        }

        const risks: string[] = [];
        if (config.no_backtracking)
            risks.push("Backtracking is disabled after students move on.");
        if (config.one_question_at_a_time)
            risks.push("Students only see one question at a time.");
        if (config.require_session_attendance)
            risks.push("Students must already be marked present to enter.");
        return risks;
    }, [config]);

    const updateConfigField = <K extends keyof AssessmentExamConfig>(
        field: K,
        value: AssessmentExamConfig[K],
    ) => {
        setConfig((current) =>
            current
                ? {
                      ...current,
                      [field]: value,
                  }
                : current,
        );
        setStatusMessage("");
    };

    const addQuestion = () => {
        if (!assessment) return;
        const base = normalizeExamQuestion(
            {
                assessment_id: assessment.id,
                prompt: "",
                question_type: "multiple_choice",
                points: 1,
                position: questions.length,
                is_required: true,
                is_published: true,
            },
            questions.length,
        );
        setQuestions((current) => [
            ...current,
            {
                ...base,
                choices: getDefaultChoicesForQuestionType(
                    base.question_type,
                ).map((choice, index) =>
                    normalizeQuestionChoice(choice, base.id, index),
                ),
            },
        ]);
        setStatusMessage("");
    };
    const updateQuestion = <K extends keyof AssessmentQuestion>(
        questionId: string,
        field: K,
        value: AssessmentQuestion[K],
    ) => {
        setQuestions((current) =>
            current.map((question, index) => {
                if (question.id !== questionId) {
                    return question;
                }

                const next = {
                    ...question,
                    [field]: value,
                    position: index,
                };

                if (field === "question_type") {
                    const nextType =
                        value as AssessmentQuestion["question_type"];
                    if (
                        nextType === "multiple_choice" ||
                        nextType === "true_false"
                    ) {
                        next.choices = getDefaultChoicesForQuestionType(
                            nextType,
                        ).map((choice, choiceIndex) =>
                            normalizeQuestionChoice(
                                choice,
                                question.id,
                                choiceIndex,
                            ),
                        );
                    } else {
                        next.choices = [];
                    }
                }

                return next;
            }),
        );
        setStatusMessage("");
    };

    const removeQuestion = (questionId: string) => {
        setQuestions((current) =>
            current
                .filter((question) => question.id !== questionId)
                .map((question, index) => ({ ...question, position: index })),
        );
        setStatusMessage("");
    };

    const addChoice = (questionId: string) => {
        setQuestions((current) =>
            current.map((question) => {
                if (question.id !== questionId) {
                    return question;
                }

                const nextChoice = normalizeQuestionChoice(
                    {
                        question_id: questionId,
                        label: `Choice ${question.choices.length + 1}`,
                        position: question.choices.length,
                        is_correct: question.choices.length === 0,
                    },
                    questionId,
                    question.choices.length,
                );

                return {
                    ...question,
                    choices: [...question.choices, nextChoice],
                };
            }),
        );
        setStatusMessage("");
    };

    const updateChoice = (
        questionId: string,
        choiceId: string,
        field: keyof QuestionChoice,
        value: string | number | boolean,
    ) => {
        setQuestions((current) =>
            current.map((question) => {
                if (question.id !== questionId) return question;

                let choices = question.choices.map((choice, index) => {
                    if (choice.id !== choiceId) {
                        return { ...choice, position: index };
                    }
                    return { ...choice, [field]: value, position: index };
                });

                if (field === "is_correct" && value === true) {
                    choices = choices.map((choice) => ({
                        ...choice,
                        is_correct: choice.id === choiceId,
                    }));
                }

                return { ...question, choices };
            }),
        );
        setStatusMessage("");
    };

    const removeChoice = (questionId: string, choiceId: string) => {
        setQuestions((current) =>
            current.map((question) => {
                if (question.id !== questionId) return question;

                const nextChoices = question.choices
                    .filter((choice) => choice.id !== choiceId)
                    .map((choice, index) => ({ ...choice, position: index }));
                return { ...question, choices: nextChoices };
            }),
        );
        setStatusMessage("");
    };

    const handleSaveConfig = async () => {
        if (!assessment || !config) return;

        setSavingConfig(true);
        const { error } = await supabase.from("assessment_exam_configs").upsert(
            {
                ...config,
                assessment_id: assessment.id,
                group_id: assessment.group_id,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "assessment_id" },
        );

        setSavingConfig(false);

        if (error) {
            await showAlert({
                title: "Failed To Save Exam Settings",
                description: error.message,
                variant: "error",
            });
            return;
        }

        setStatusMessage("Exam settings saved.");
        await onSaved();
    };

    const handleSaveQuestions = async () => {
        if (!assessment) return;

        if (questions.some((question) => !question.prompt.trim())) {
            await showAlert({
                title: "Question Prompt Required",
                description: "Every question needs a prompt before saving.",
                variant: "warning",
            });
            return;
        }

        if (
            questions.some(
                (question) =>
                    (question.question_type === "multiple_choice" ||
                        question.question_type === "true_false") &&
                    (!question.choices.length ||
                        question.choices.filter((choice) => choice.is_correct)
                            .length !== 1),
            )
        ) {
            await showAlert({
                title: "Objective Questions Need One Correct Choice",
                description:
                    "Multiple choice and true/false questions must have exactly one correct choice.",
                variant: "warning",
            });
            return;
        }

        setSavingQuestions(true);

        const { error: deleteError } = await supabase
            .from("assessment_questions")
            .delete()
            .eq("assessment_id", assessment.id);

        if (deleteError) {
            setSavingQuestions(false);
            await showAlert({
                title: "Failed To Save Questions",
                description: deleteError.message,
                variant: "error",
            });
            return;
        }

        if (questions.length > 0) {
            const questionRows = questions.map((question, index) => ({
                id: question.id,
                assessment_id: assessment.id,
                prompt: question.prompt.trim(),
                description: question.description?.trim() || null,
                question_type: question.question_type,
                points: Number(question.points || 0),
                position: index,
                is_required: question.is_required,
                is_published: question.is_published,
                answer_text: question.answer_text?.trim() || null,
                updated_at: new Date().toISOString(),
            }));

            const { error: questionError } = await supabase
                .from("assessment_questions")
                .insert(questionRows);

            if (questionError) {
                setSavingQuestions(false);
                await showAlert({
                    title: "Failed To Save Questions",
                    description: questionError.message,
                    variant: "error",
                });
                return;
            }

            const choiceRows = questions.flatMap((question) =>
                question.question_type === "multiple_choice" ||
                question.question_type === "true_false"
                    ? question.choices.map((choice, index) => ({
                          id: choice.id,
                          question_id: question.id,
                          label: choice.label.trim(),
                          position: index,
                          is_correct: choice.is_correct,
                      }))
                    : [],
            );

            if (choiceRows.length > 0) {
                const { error: choiceError } = await supabase
                    .from("question_choices")
                    .insert(choiceRows);

                if (choiceError) {
                    setSavingQuestions(false);
                    await showAlert({
                        title: "Failed To Save Choices",
                        description: choiceError.message,
                        variant: "error",
                    });
                    return;
                }
            }
        }

        setSavingQuestions(false);
        setStatusMessage("Questions saved.");
        await loadEditor();
        await onSaved();
    };
    if (!assessment) {
        return (
            <div className="rounded-[28px] border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
                Assessment not found.
            </div>
        );
    }

    if (!config || loading) {
        return (
            <div className="rounded-[28px] border border-border/80 bg-card p-12 shadow-sm">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
                <div className="rounded-[28px] border border-border/80 bg-card px-6 py-6 shadow-sm md:px-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                            <Badge
                                variant="outline"
                                className="bg-primary/6 text-primary"
                            >
                                Exam setup wizard
                            </Badge>
                            <div className="space-y-2">
                                <h2 className="font-display text-3xl text-foreground">
                                    Configure a confident launch
                                </h2>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                    Set the exam window, review student-facing
                                    rules, and publish a question set that feels
                                    clear for instructors and calm for students.
                                </p>
                            </div>
                        </div>
                        {config.is_enabled && examUrl ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(
                                            examUrl,
                                        );
                                        setStatusMessage("Exam link copied.");
                                    }}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy link
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                >
                                    <a
                                        href={examUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open exam
                                    </a>
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Question bank
                            </div>
                            <div className="mt-3 text-3xl font-semibold text-foreground">
                                {questionCount}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {publishedQuestionCount} published and ready for
                                students.
                            </p>
                        </div>
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Total points
                            </div>
                            <div className="mt-3 text-3xl font-semibold text-foreground">
                                {totalPoints}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {objectiveQuestionCount} auto-graded,{" "}
                                {manualReviewCount} manual review.
                            </p>
                        </div>
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Attempt activity
                            </div>
                            <div className="mt-3 text-3xl font-semibold text-foreground">
                                {attempts.length}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {hasAttempts
                                    ? "Question structure is now protected."
                                    : "No student attempts yet."}
                            </p>
                        </div>
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Exam window
                            </div>
                            <div className="mt-3 text-base font-semibold text-foreground">
                                {formatExamWindow(
                                    config.start_at,
                                    config.end_at,
                                )}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {config.duration_minutes} minute duration,{" "}
                                {config.max_attempts} attempt limit.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-border/80 bg-card px-6 py-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Review and launch
                            </div>
                            <h3 className="font-display text-2xl text-foreground">
                                Launch readiness
                            </h3>
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {launchSignals.length === 0 ? (
                            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div>
                                        <div className="font-medium">
                                            Ready for instructor review
                                        </div>
                                        <p className="mt-1 text-emerald-800/90">
                                            Settings, availability, and question
                                            bank look launch-ready.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div>
                                        <div className="font-medium">
                                            Review before opening access
                                        </div>
                                        <ul className="mt-2 space-y-1.5 text-amber-800/90">
                                            {launchSignals.map((signal) => (
                                                <li key={signal}>{signal}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {riskSettings.length > 0 ? (
                            <div className="rounded-[20px] border border-border/80 bg-background px-4 py-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Lock className="h-4 w-4 text-primary" />
                                    Student experience rules
                                </div>
                                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                                    {riskSettings.map((risk) => (
                                        <li key={risk}>{risk}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        <div className="rounded-[20px] border border-border/80 bg-background px-4 py-4 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">
                                Exam access
                            </div>
                            <p className="mt-2 leading-6">
                                {config.is_enabled
                                    ? "Students can reach the exam link when other access checks pass."
                                    : "The exam link remains unavailable until you enable access."}
                            </p>
                            <p className="mt-2 leading-6">
                                {config.access_code
                                    ? "An access code is currently required at entry."
                                    : "No access code is currently required."}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {statusMessage ? (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
                    {statusMessage}
                </div>
            ) : null}

            {hasAttempts ? (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                    Students already started this exam. Question editing is
                    locked to protect live attempt history.
                </div>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                <div className="space-y-6">
                    <div className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <Badge
                                    variant="outline"
                                    className="bg-primary/6 text-primary"
                                >
                                    Step 1
                                </Badge>
                                <h3 className="mt-3 font-display text-2xl text-foreground">
                                    Availability and access
                                </h3>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                    Control when students can enter, how long
                                    the attempt lasts, and whether a code is
                                    needed at the door.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => void handleSaveConfig()}
                                disabled={savingConfig}
                            >
                                {savingConfig ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Save settings
                            </Button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2.5">
                                <Label>Exam enabled</Label>
                                <Select
                                    value={boolValue(config.is_enabled)}
                                    onValueChange={(value) =>
                                        updateConfigField(
                                            "is_enabled",
                                            value === "yes",
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="yes">Yes</SelectItem>
                                        <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2.5">
                                <Label>Published to students</Label>
                                <Select
                                    value={boolValue(config.is_published)}
                                    onValueChange={(value) =>
                                        updateConfigField(
                                            "is_published",
                                            value === "yes",
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="yes">Yes</SelectItem>
                                        <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2.5">
                                <Label>Duration (minutes)</Label>
                                <Input
                                    value={String(config.duration_minutes)}
                                    inputMode="numeric"
                                    onChange={(event) =>
                                        updateConfigField(
                                            "duration_minutes",
                                            Math.max(
                                                1,
                                                Number(event.target.value || 1),
                                            ),
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label>Max attempts</Label>
                                <Input
                                    value={String(config.max_attempts)}
                                    inputMode="numeric"
                                    onChange={(event) =>
                                        updateConfigField(
                                            "max_attempts",
                                            Math.max(
                                                1,
                                                Number(event.target.value || 1),
                                            ),
                                        )
                                    }
                                />
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                            <div className="space-y-2.5">
                                <Label>Start at</Label>
                                <Input
                                    type="datetime-local"
                                    value={
                                        config.start_at
                                            ? config.start_at.slice(0, 16)
                                            : ""
                                    }
                                    onChange={(event) =>
                                        updateConfigField(
                                            "start_at",
                                            event.target.value
                                                ? new Date(
                                                      event.target.value,
                                                  ).toISOString()
                                                : null,
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label>End at</Label>
                                <Input
                                    type="datetime-local"
                                    value={
                                        config.end_at
                                            ? config.end_at.slice(0, 16)
                                            : ""
                                    }
                                    onChange={(event) =>
                                        updateConfigField(
                                            "end_at",
                                            event.target.value
                                                ? new Date(
                                                      event.target.value,
                                                  ).toISOString()
                                                : null,
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label>Access code</Label>
                                <Input
                                    value={config.access_code || ""}
                                    onChange={(event) =>
                                        updateConfigField(
                                            "access_code",
                                            event.target.value || null,
                                        )
                                    }
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm">
                        <div>
                            <Badge
                                variant="outline"
                                className="bg-primary/6 text-primary"
                            >
                                Step 2
                            </Badge>
                            <h3 className="mt-3 font-display text-2xl text-foreground">
                                Student rules and safeguards
                            </h3>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Use stricter controls only where they genuinely
                                improve exam integrity. The goal is confident
                                supervision without unnecessary stress.
                            </p>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {toggleSettingFields.map((setting) => (
                                <div
                                    key={setting.field}
                                    className="rounded-[22px] border border-border/80 bg-background px-4 py-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="font-medium text-foreground">
                                                    {setting.label}
                                                </div>
                                                {setting.risk ? (
                                                    <Badge variant="warning">
                                                        High attention
                                                    </Badge>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                {setting.description}
                                            </p>
                                        </div>
                                        <div className="w-[120px] shrink-0">
                                            <Select
                                                value={boolValue(
                                                    config[
                                                        setting.field
                                                    ] as boolean,
                                                )}
                                                onValueChange={(value) =>
                                                    updateConfigField(
                                                        setting.field,
                                                        value === "yes",
                                                    )
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="yes">
                                                        Yes
                                                    </SelectItem>
                                                    <SelectItem value="no">
                                                        No
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm">
                    <div>
                        <Badge
                            variant="outline"
                            className="bg-primary/6 text-primary"
                        >
                            Step 3
                        </Badge>
                        <h3 className="mt-3 font-display text-2xl text-foreground">
                            Final review
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Confirm the essentials before you send students into
                            a live attempt.
                        </p>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Student-facing summary
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-foreground">
                                <div className="flex items-center justify-between gap-4">
                                    <span>Window</span>
                                    <span className="text-right text-muted-foreground">
                                        {formatExamWindow(
                                            config.start_at,
                                            config.end_at,
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Duration</span>
                                    <span className="text-muted-foreground">
                                        {config.duration_minutes} minutes
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Question set</span>
                                    <span className="text-muted-foreground">
                                        {questionCount} questions /{" "}
                                        {totalPoints} points
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Entry protection</span>
                                    <span className="text-muted-foreground">
                                        {config.access_code
                                            ? "Access code required"
                                            : "Open entry"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Instructor notes
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                                <li>
                                    Question edits are{" "}
                                    {hasAttempts ? "locked" : "available"}.
                                </li>
                                <li>
                                    {config.show_results_immediately
                                        ? "Scores may appear immediately after submission."
                                        : "Scores remain hidden until you publish results elsewhere."}
                                </li>
                                <li>
                                    {config.one_question_at_a_time
                                        ? "Students progress one question at a time."
                                        : "Students can view the broader exam flow."}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
            <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <Badge
                            variant="outline"
                            className="bg-primary/6 text-primary"
                        >
                            Step 4
                        </Badge>
                        <h3 className="mt-3 font-display text-2xl text-foreground">
                            Question set
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Build the question sequence students will see during
                            the timed attempt.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                            {totalPoints} total points
                        </Badge>
                    </div>
                </div>

                {questions.length === 0 ? (
                    <div className="mt-6 rounded-[22px] border border-dashed border-border/80 bg-background/70 px-4 py-10 text-center text-sm text-muted-foreground">
                        No exam questions yet.
                    </div>
                ) : (
                    <div className="mt-6 space-y-5">
                        {questions.map((question, index) => (
                            <div
                                key={question.id}
                                className="rounded-[24px] border border-border/80 bg-background px-4 py-5 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">
                                                Question {index + 1}
                                            </Badge>
                                            <Badge variant="secondary">
                                                {formatExamQuestionType(
                                                    question.question_type,
                                                )}
                                            </Badge>
                                            {question.is_required ? (
                                                <Badge variant="outline">
                                                    Required
                                                </Badge>
                                            ) : null}
                                            {!question.is_published ? (
                                                <Badge variant="warning">
                                                    Hidden
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-3 text-sm text-muted-foreground">
                                            Configure prompt, grading weight,
                                            and answer structure.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() =>
                                            removeQuestion(question.id)
                                        }
                                        disabled={hasAttempts}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="mt-5 space-y-4">
                                    <div className="space-y-2.5">
                                        <Label>Prompt</Label>
                                        <textarea
                                            placeholder="Question"
                                            value={question.prompt}
                                            onChange={(event) =>
                                                updateQuestion(
                                                    question.id,
                                                    "prompt",
                                                    event.target.value,
                                                )
                                            }
                                            disabled={hasAttempts}
                                            className="min-h-28 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10"
                                        />
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label>Description</Label>
                                        <textarea
                                            placeholder="Decription"
                                            value={question.description || ""}
                                            onChange={(event) =>
                                                updateQuestion(
                                                    question.id,
                                                    "description",
                                                    event.target.value,
                                                )
                                            }
                                            disabled={hasAttempts}
                                            className="min-h-24 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10"
                                        />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-4">
                                        <div className="space-y-2.5">
                                            <Label>Type</Label>
                                            <Select
                                                value={question.question_type}
                                                onValueChange={(value) =>
                                                    updateQuestion(
                                                        question.id,
                                                        "question_type",
                                                        value as AssessmentQuestion["question_type"],
                                                    )
                                                }
                                                disabled={hasAttempts}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {examQuestionTypeOptions.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label>Points</Label>
                                            <Input
                                                value={String(question.points)}
                                                inputMode="decimal"
                                                onChange={(event) =>
                                                    updateQuestion(
                                                        question.id,
                                                        "points",
                                                        Number(
                                                            event.target
                                                                .value || 0,
                                                        ),
                                                    )
                                                }
                                                disabled={hasAttempts}
                                            />
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label>Required</Label>
                                            <Select
                                                value={boolValue(
                                                    question.is_required,
                                                )}
                                                onValueChange={(value) =>
                                                    updateQuestion(
                                                        question.id,
                                                        "is_required",
                                                        value === "yes",
                                                    )
                                                }
                                                disabled={hasAttempts}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="yes">
                                                        Yes
                                                    </SelectItem>
                                                    <SelectItem value="no">
                                                        No
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label>Published</Label>
                                            <Select
                                                value={boolValue(
                                                    question.is_published,
                                                )}
                                                onValueChange={(value) =>
                                                    updateQuestion(
                                                        question.id,
                                                        "is_published",
                                                        value === "yes",
                                                    )
                                                }
                                                disabled={hasAttempts}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="yes">
                                                        Yes
                                                    </SelectItem>
                                                    <SelectItem value="no">
                                                        No
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/*{(question.question_type === "short_answer" || question.question_type === "essay") && (
                                        <div className="space-y-2.5">
                                            <Label>Reference answer</Label>
                                            <textarea value={question.answer_text || ""} onChange={(event) => updateQuestion(question.id, "answer_text", event.target.value)} disabled={hasAttempts} className="min-h-24 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10" />
                                        </div>
                                    )}*/}

                                    {(question.question_type ===
                                        "multiple_choice" ||
                                        question.question_type ===
                                            "true_false") && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <Label>Choices</Label>
                                                {question.question_type ===
                                                "multiple_choice" ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            addChoice(
                                                                question.id,
                                                            )
                                                        }
                                                        disabled={hasAttempts}
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Add choice
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <div className="space-y-2.5">
                                                {question.choices.map(
                                                    (choice) => (
                                                        <div
                                                            key={choice.id}
                                                            className="grid gap-3 md:grid-cols-[1fr_136px_48px]"
                                                        >
                                                            <Input
                                                                value={
                                                                    choice.label
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateChoice(
                                                                        question.id,
                                                                        choice.id,
                                                                        "label",
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    hasAttempts
                                                                }
                                                            />
                                                            <Select
                                                                value={boolValue(
                                                                    choice.is_correct,
                                                                )}
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    updateChoice(
                                                                        question.id,
                                                                        choice.id,
                                                                        "is_correct",
                                                                        value ===
                                                                            "yes",
                                                                    )
                                                                }
                                                                disabled={
                                                                    hasAttempts
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="yes">
                                                                        Correct
                                                                    </SelectItem>
                                                                    <SelectItem value="no">
                                                                        Wrong
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="text-muted-foreground hover:text-destructive"
                                                                onClick={() =>
                                                                    removeChoice(
                                                                        question.id,
                                                                        choice.id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    hasAttempts ||
                                                                    question.question_type ===
                                                                        "true_false" ||
                                                                    question
                                                                        .choices
                                                                        .length <=
                                                                        2
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addQuestion}
                        disabled={hasAttempts}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add question
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleSaveQuestions()}
                        disabled={savingQuestions || hasAttempts}
                    >
                        {savingQuestions ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save question set
                    </Button>
                </div>
            </section>

            <section className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm">
                <div>
                    <h3 className="font-display text-2xl text-foreground">
                        Attempts
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Track who has entered, submitted, or still needs grading
                        review.
                    </p>
                </div>
                <div className="mt-5 overflow-hidden rounded-[22px] border border-border/80 bg-background pb-3">
                    {attempts.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            No student attempts yet.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Attempt</TableHead>
                                    <TableHead>Started</TableHead>
                                    <TableHead>Submitted</TableHead>
                                    <TableHead>Score</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attempts.map((attempt) => (
                                    <TableRow key={attempt.id}>
                                        <TableCell>
                                            <div className="font-medium text-foreground">
                                                {attempt.student_name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {attempt.university_id}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {attempt.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            #{attempt.attempt_number}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(
                                                attempt.started_at,
                                            ).toLocaleString("en-US")}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {attempt.submitted_at
                                                ? new Date(
                                                      attempt.submitted_at,
                                                  ).toLocaleString("en-US")
                                                : "-"}
                                        </TableCell>
                                        <TableCell>
                                            {formatAttemptScore(
                                                attempt.score,
                                                attempt.max_score,
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </section>
        </div>
    );
}
