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
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Copy, ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";

function boolValue(value: boolean) {
    return value ? "yes" : "no";
}

interface QuestionDraft extends AssessmentQuestion {
    choices: QuestionChoice[];
}

export function ExamSetupDialog({
    assessment,
    open,
    onOpenChange,
    onSaved,
}: {
    assessment: CourseworkAssessment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
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

    const loadDialog = useCallback(async () => {
        if (!assessment || !open) {
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
            ((questionsRes.data || []) as Array<
                AssessmentQuestion & { choices?: QuestionChoice[] | QuestionChoice[][] }
            >).map((question, index) => {
                const normalizedQuestion = normalizeExamQuestion(question, index);
                const rawChoices = Array.isArray(question.choices)
                    ? question.choices.flatMap((choice) =>
                          Array.isArray(choice) ? choice : [choice],
                      )
                    : [];
                const normalizedChoices = rawChoices.map((choice, choiceIndex) =>
                    normalizeQuestionChoice(choice, normalizedQuestion.id, choiceIndex),
                );

                return {
                    ...normalizedQuestion,
                    choices:
                        normalizedChoices.length > 0
                            ? normalizedChoices
                            : getDefaultChoicesForQuestionType(normalizedQuestion.question_type).map(
                                  (choice, choiceIndex) =>
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
    }, [assessment, open, supabase]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void loadDialog();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [loadDialog]);

    const questionCount = questions.length;
    const totalPoints = useMemo(
        () => questions.reduce((sum, question) => sum + Number(question.points || 0), 0),
        [questions],
    );
    const hasAttempts = attempts.length > 0;
    const examUrl =
        assessment && typeof window !== "undefined"
            ? `${window.location.origin}/exam/${assessment.id}`
            : "";

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
                choices: getDefaultChoicesForQuestionType(base.question_type).map(
                    (choice, index) => normalizeQuestionChoice(choice, base.id, index),
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
                    const nextType = value as AssessmentQuestion["question_type"];
                    if (nextType === "multiple_choice" || nextType === "true_false") {
                        next.choices = getDefaultChoicesForQuestionType(nextType).map(
                            (choice, choiceIndex) =>
                                normalizeQuestionChoice(choice, question.id, choiceIndex),
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

                return { ...question, choices: [...question.choices, nextChoice] };
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
                        question.choices.filter((choice) => choice.is_correct).length !== 1),
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
        await loadDialog();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {assessment ? `${assessment.title} Exam Setup` : "Exam Setup"}
                    </DialogTitle>
                </DialogHeader>

                {!assessment || !config ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="space-y-6 py-2">
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="rounded-lg border bg-gray-50 p-4"><div className="text-sm text-gray-500">Questions</div><div className="mt-1 text-2xl font-bold text-gray-900">{questionCount}</div></div>
                            <div className="rounded-lg border bg-gray-50 p-4"><div className="text-sm text-gray-500">Question Points</div><div className="mt-1 text-2xl font-bold text-gray-900">{totalPoints}</div></div>
                            <div className="rounded-lg border bg-gray-50 p-4"><div className="text-sm text-gray-500">Attempts</div><div className="mt-1 text-2xl font-bold text-gray-900">{attempts.length}</div></div>
                            <div className="rounded-lg border bg-gray-50 p-4"><div className="text-sm text-gray-500">Window</div><div className="mt-1 text-sm font-medium text-gray-900">{formatExamWindow(config.start_at, config.end_at)}</div></div>
                        </div>
                        {statusMessage ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div> : null}
                        {hasAttempts ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Students already started this exam. Question editing is locked to protect existing attempts.</div> : null}
                        <div className="rounded-lg border bg-white p-4 space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div><h3 className="font-semibold text-gray-900">Exam Settings</h3><p className="text-sm text-gray-500">Turn this assessment into a timed exam and control how students access it.</p></div>
                                {config.is_enabled && examUrl ? <div className="flex gap-2"><Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(examUrl); setStatusMessage("Exam link copied."); }}><Copy className="mr-2 h-4 w-4" />Copy Link</Button><Button asChild variant="outline"><a href={examUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open Exam</a></Button></div> : null}
                            </div>
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="space-y-2"><Label>Enabled</Label><Select value={boolValue(config.is_enabled)} onValueChange={(value) => updateConfigField("is_enabled", value === "yes")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Published</Label><Select value={boolValue(config.is_published)} onValueChange={(value) => updateConfigField("is_published", value === "yes")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Duration (minutes)</Label><Input value={String(config.duration_minutes)} inputMode="numeric" onChange={(event) => updateConfigField("duration_minutes", Math.max(1, Number(event.target.value || 1)))} /></div>
                                <div className="space-y-2"><Label>Max Attempts</Label><Input value={String(config.max_attempts)} inputMode="numeric" onChange={(event) => updateConfigField("max_attempts", Math.max(1, Number(event.target.value || 1)))} /></div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2"><Label>Start At</Label><Input type="datetime-local" value={config.start_at ? config.start_at.slice(0, 16) : ""} onChange={(event) => updateConfigField("start_at", event.target.value ? new Date(event.target.value).toISOString() : null)} /></div>
                                <div className="space-y-2"><Label>End At</Label><Input type="datetime-local" value={config.end_at ? config.end_at.slice(0, 16) : ""} onChange={(event) => updateConfigField("end_at", event.target.value ? new Date(event.target.value).toISOString() : null)} /></div>
                                <div className="space-y-2"><Label>Access Code</Label><Input value={config.access_code || ""} onChange={(event) => updateConfigField("access_code", event.target.value || null)} placeholder="Optional" /></div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                                {[ ["shuffle_questions", "Shuffle Questions"], ["shuffle_choices", "Shuffle Choices"], ["one_question_at_a_time", "One Question Mode"], ["no_backtracking", "No Backtracking"], ["show_results_immediately", "Show Results"], ["require_session_attendance", "Require Attendance"], ].map(([field, label]) => (<div key={field} className="space-y-2"><Label>{label}</Label><Select value={boolValue(config[field as keyof AssessmentExamConfig] as boolean)} onValueChange={(value) => updateConfigField(field as keyof AssessmentExamConfig, value === "yes")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>))}
                            </div>
                            <div className="flex justify-end"><Button type="button" onClick={() => void handleSaveConfig()} disabled={savingConfig}>{savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Settings</Button></div>
                        </div>
                        <div className="rounded-lg border bg-white p-4 space-y-4">
                            <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-gray-900">Questions</h3><p className="text-sm text-gray-500">Build the question set students will receive in their timed attempt.</p></div><div className="flex gap-2"><Badge variant="outline">Total points {totalPoints}</Badge><Button type="button" variant="outline" onClick={addQuestion} disabled={hasAttempts}><Plus className="mr-2 h-4 w-4" />Add Question</Button></div></div>
                            {questions.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-gray-500">No exam questions yet.</div> : <div className="space-y-4">{questions.map((question, index) => (<div key={question.id} className="rounded-lg border p-4 space-y-4"><div className="flex items-center justify-between gap-3"><div><div className="font-medium text-gray-900">Question {index + 1}</div><div className="text-xs text-gray-500">{formatExamQuestionType(question.question_type)}</div></div><Button type="button" variant="ghost" size="icon-sm" className="text-gray-400 hover:text-red-600" onClick={() => removeQuestion(question.id)} disabled={hasAttempts}><Trash2 className="h-4 w-4" /></Button></div><div className="space-y-2"><Label>Prompt</Label><textarea value={question.prompt} onChange={(event) => updateQuestion(question.id, "prompt", event.target.value)} disabled={hasAttempts} className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs" /></div><div className="space-y-2"><Label>Description</Label><textarea value={question.description || ""} onChange={(event) => updateQuestion(question.id, "description", event.target.value)} disabled={hasAttempts} className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs" /></div><div className="grid gap-4 md:grid-cols-4"><div className="space-y-2"><Label>Type</Label><Select value={question.question_type} onValueChange={(value) => updateQuestion(question.id, "question_type", value as AssessmentQuestion["question_type"])} disabled={hasAttempts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{examQuestionTypeOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent></Select></div><div className="space-y-2"><Label>Points</Label><Input value={String(question.points)} inputMode="decimal" onChange={(event) => updateQuestion(question.id, "points", Number(event.target.value || 0))} disabled={hasAttempts} /></div><div className="space-y-2"><Label>Required</Label><Select value={boolValue(question.is_required)} onValueChange={(value) => updateQuestion(question.id, "is_required", value === "yes")} disabled={hasAttempts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Published</Label><Select value={boolValue(question.is_published)} onValueChange={(value) => updateQuestion(question.id, "is_published", value === "yes")} disabled={hasAttempts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div></div>{(question.question_type === "short_answer" || question.question_type === "essay") && (<div className="space-y-2"><Label>Reference Answer</Label><textarea value={question.answer_text || ""} onChange={(event) => updateQuestion(question.id, "answer_text", event.target.value)} disabled={hasAttempts} className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs" /></div>)}{(question.question_type === "multiple_choice" || question.question_type === "true_false") && (<div className="space-y-3"><div className="flex items-center justify-between gap-3"><Label>Choices</Label>{question.question_type === "multiple_choice" ? <Button type="button" size="sm" variant="outline" onClick={() => addChoice(question.id)} disabled={hasAttempts}><Plus className="mr-2 h-4 w-4" />Add Choice</Button> : null}</div><div className="space-y-2">{question.choices.map((choice) => (<div key={choice.id} className="grid gap-3 md:grid-cols-[1fr_120px_48px]"><Input value={choice.label} onChange={(event) => updateChoice(question.id, choice.id, "label", event.target.value)} disabled={hasAttempts} /><Select value={boolValue(choice.is_correct)} onValueChange={(value) => updateChoice(question.id, choice.id, "is_correct", value === "yes")} disabled={hasAttempts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Correct</SelectItem><SelectItem value="no">Wrong</SelectItem></SelectContent></Select><Button type="button" variant="ghost" size="icon-sm" className="text-gray-400 hover:text-red-600" onClick={() => removeChoice(question.id, choice.id)} disabled={hasAttempts || question.question_type === "true_false" || question.choices.length <= 2}><Trash2 className="h-4 w-4" /></Button></div>))}</div></div>)}</div>))}</div>}
                            <div className="flex justify-end"><Button type="button" onClick={() => void handleSaveQuestions()} disabled={savingQuestions || hasAttempts}>{savingQuestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Questions</Button></div>
                        </div>
                        <div className="rounded-lg border bg-white p-4 space-y-4"><div><h3 className="font-semibold text-gray-900">Attempts</h3><p className="text-sm text-gray-500">Quick review of who started or submitted this exam.</p></div><div className="overflow-hidden rounded-lg border">{attempts.length === 0 ? <div className="py-8 text-center text-sm text-gray-500">No student attempts yet.</div> : <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead>Attempt</TableHead><TableHead>Started</TableHead><TableHead>Submitted</TableHead><TableHead>Score</TableHead></TableRow></TableHeader><TableBody>{attempts.map((attempt) => (<TableRow key={attempt.id}><TableCell><div className="font-medium text-gray-900">{attempt.student_name}</div><div className="text-xs text-gray-500">{attempt.university_id}</div></TableCell><TableCell><Badge variant="outline">{attempt.status}</Badge></TableCell><TableCell>#{attempt.attempt_number}</TableCell><TableCell className="text-sm text-gray-500">{new Date(attempt.started_at).toLocaleString("en-US")}</TableCell><TableCell className="text-sm text-gray-500">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString("en-US") : "—"}</TableCell><TableCell>{formatAttemptScore(attempt.score, attempt.max_score)}</TableCell></TableRow>))}</TableBody></Table>}</div></div>
                    </div>
                )}
                <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


