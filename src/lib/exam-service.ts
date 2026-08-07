import { supabaseAdmin } from "@/lib/supabase/admin";
import { secureEquals } from "@/lib/secure-compare";
import {
    buildAttemptPresentation,
    calculateAttemptMaxScore,
    calculateExamScoreSummary,
    gradeAttemptAnswers,
    shuffleArray,
    sortQuestions,
    type AssessmentAttempt,
    type AssessmentExamConfig,
    type AssessmentQuestion,
    type AttemptAnswer,
    type ExamQuestionSnapshot,
    type QuestionChoice,
} from "@/lib/exams";

export async function getAssessmentWithExamConfig(assessmentId: string) {
    const { data, error } = await supabaseAdmin
        .from("coursework_assessments")
        .select(
            "id, group_id, session_id, title, max_score, groups!inner(professor_id), exam:assessment_exam_configs(*)",
        )
        .eq("id", assessmentId)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        assessment: {
            id: data.id as string,
            group_id: data.group_id as string,
            session_id: (data.session_id as string | null) ?? null,
            title: data.title as string,
            max_score: Number(data.max_score || 0),
            professor_id: Array.isArray(data.groups)
                ? ((data.groups[0] as { professor_id?: string } | undefined)
                      ?.professor_id ?? "")
                : ((data.groups as { professor_id?: string } | null)
                      ?.professor_id ?? ""),
        },
        config: Array.isArray(data.exam)
            ? (data.exam[0] as AssessmentExamConfig | null)
            : ((data.exam as AssessmentExamConfig | null) ?? null),
    };
}

export async function getPublishedExamQuestions(assessmentId: string) {
    const { data, error } = await supabaseAdmin
        .from("assessment_questions")
        .select(
            "id, assessment_id, prompt, description, question_type, points, position, is_required, is_published, answer_text, choices:question_choices(id, question_id, label, position, is_correct)",
        )
        .eq("assessment_id", assessmentId)
        .eq("is_published", true)
        .order("position", { ascending: true });

    if (error) {
        return [] as ExamQuestionSnapshot[];
    }

    return ((data || []) as Array<AssessmentQuestion & { choices?: QuestionChoice[] }>).map(
        (question) => ({
            ...(question as AssessmentQuestion),
            choices: sortQuestions((question.choices || []) as QuestionChoice[]),
        }),
    );
}

export async function findStudentInGroup(groupId: string, universityId: string) {
    const { data } = await supabaseAdmin
        .from("students")
        .select("id, university_id, name")
        .eq("group_id", groupId)
        .eq("university_id", universityId)
        .single();

    return data as { id: string; university_id: string; name: string } | null;
}

export function isExamAccessible(config: AssessmentExamConfig | null) {
    if (!config?.is_enabled || !config.is_published) {
        return { ok: false, message: "This exam is not currently available." };
    }

    const now = Date.now();
    if (config.start_at && new Date(config.start_at).getTime() > now) {
        return { ok: false, message: "This exam has not opened yet." };
    }
    if (config.end_at && new Date(config.end_at).getTime() < now) {
        return { ok: false, message: "This exam is closed." };
    }

    return { ok: true, message: "" };
}

export async function requireAttendanceIfNeeded(args: {
    config: AssessmentExamConfig | null;
    sessionId: string | null;
    studentId: string;
}) {
    const { config, sessionId, studentId } = args;
    if (!config?.require_session_attendance || !sessionId) {
        return true;
    }

    const { data } = await supabaseAdmin
        .from("attendance_records")
        .select("id")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .maybeSingle();

    return Boolean(data);
}

function createAttemptOrdering(args: {
    questions: ExamQuestionSnapshot[];
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
}) {
    const { questions, shuffleQuestions, shuffleChoices } = args;
    const orderedQuestions = shuffleQuestions ? shuffleArray(questions) : sortQuestions(questions);
    const questionOrder = orderedQuestions.map((question) => question.id);
    const choiceOrder = Object.fromEntries(
        orderedQuestions.map((question) => [
            question.id,
            (shuffleChoices ? shuffleArray(question.choices) : sortQuestions(question.choices)).map(
                (choice) => choice.id,
            ),
        ]),
    ) as Record<string, string[]>;

    return { questionOrder, choiceOrder };
}

export async function startExamAttempt(args: {
    assessmentId: string;
    universityId: string;
    accessCode?: string | null;
    fingerprint?: string | null;
    deviceId?: string | null;
}) {
    const exam = await getAssessmentWithExamConfig(args.assessmentId);
    if (!exam) {
        return { ok: false, status: 404, error: "Assessment not found." } as const;
    }

    const accessibility = isExamAccessible(exam.config);
    if (!accessibility.ok) {
        return { ok: false, status: 400, error: accessibility.message } as const;
    }

    if (
        exam.config?.access_code &&
        !secureEquals(exam.config.access_code, args.accessCode)
    ) {
        return { ok: false, status: 400, error: "Access code is incorrect." } as const;
    }

    const student = await findStudentInGroup(exam.assessment.group_id, args.universityId);
    if (!student) {
        return { ok: false, status: 404, error: "Student not found in this group." } as const;
    }

    const hasAttendance = await requireAttendanceIfNeeded({
        config: exam.config,
        sessionId: exam.assessment.session_id,
        studentId: student.id,
    });
    if (!hasAttendance) {
        return {
            ok: false,
            status: 400,
            error: "Attendance is required before starting this exam.",
        } as const;
    }

    const { data: existingAttempts } = await supabaseAdmin
        .from("assessment_attempts")
        .select("*")
        .eq("assessment_id", args.assessmentId)
        .eq("student_id", student.id)
        .order("attempt_number", { ascending: false });

    const attempts = (existingAttempts || []) as AssessmentAttempt[];
    const latestInProgress = attempts.find((attempt) => attempt.status === "in_progress");
    if (latestInProgress) {
        // Hard check: persistent device UUID.
        //
        // A *missing* device id counts as a mismatch. Requiring `args.deviceId`
        // to be present made the whole lock opt-in for the caller: omitting the
        // field from the JSON body skipped the check and returned the in-
        // progress attempt — including its access token — to anyone who knew a
        // classmate's university id, which is enough to read or submit their
        // exam. The browser always sends one (getOrCreateDeviceId falls back to
        // a fresh UUID when storage is unavailable), so only a hand-crafted
        // request arrives without it.
        if (
            latestInProgress.device_id &&
            latestInProgress.device_id !== args.deviceId
        ) {
            await supabaseAdmin.from("attempt_events").insert({
                attempt_id: latestInProgress.id,
                event_type: "duplicate_session_detected",
                payload: {
                    previous_device_id: latestInProgress.device_id,
                    attempted_device_id: args.deviceId ?? null,
                    device_id_missing: !args.deviceId,
                    severity: "hard",
                },
            });
            return {
                ok: false,
                status: 409,
                error: "This exam is already active on another device.",
            } as const;
        }

        // Soft check: FingerprintJS visitorId (may collide on identical hardware)
        if (
            latestInProgress.device_fingerprint &&
            args.fingerprint &&
            latestInProgress.device_fingerprint !== args.fingerprint &&
            // Only flag if device_id didn't already match (avoid double-flagging)
            !(latestInProgress.device_id && args.deviceId && latestInProgress.device_id === args.deviceId)
        ) {
            await supabaseAdmin.from("attempt_events").insert({
                attempt_id: latestInProgress.id,
                event_type: "duplicate_session_detected",
                payload: {
                    previous_fingerprint: latestInProgress.device_fingerprint,
                    attempted_fingerprint: args.fingerprint,
                    severity: "soft",
                },
            });
            // Soft: log but don't block — allow reconnect
        }

        return { ok: true, attempt: latestInProgress, reused: true } as const;
    }

    if (attempts.length >= (exam.config?.max_attempts || 1)) {
        return { ok: false, status: 400, error: "No remaining attempts for this exam." } as const;
    }

    const questions = await getPublishedExamQuestions(args.assessmentId);
    if (questions.length === 0) {
        return { ok: false, status: 400, error: "No published questions are available." } as const;
    }

    const ordering = createAttemptOrdering({
        questions,
        shuffleQuestions: exam.config?.shuffle_questions !== false,
        shuffleChoices: exam.config?.shuffle_choices !== false,
    });
    const now = new Date();
    const deadline = new Date(now.getTime() + (exam.config?.duration_minutes || 30) * 60000);
    const attemptNumber = (attempts[0]?.attempt_number || 0) + 1;
    const accessToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const maxScore = calculateAttemptMaxScore(questions);

    const { data: created, error: createError } = await supabaseAdmin
        .from("assessment_attempts")
        .insert({
            assessment_id: args.assessmentId,
            student_id: student.id,
            university_id: student.university_id,
            student_name: student.name,
            status: "in_progress",
            attempt_number: attemptNumber,
            started_at: now.toISOString(),
            deadline_at: deadline.toISOString(),
            last_seen_at: now.toISOString(),
            current_index: 0,
            access_token: accessToken,
            question_order: ordering.questionOrder,
            choice_order: ordering.choiceOrder,
            device_fingerprint: args.fingerprint || null,
            device_id: args.deviceId || null,
            max_score: maxScore,
        })
        .select("*")
        .single();

    if (createError || !created) {
        return { ok: false, status: 500, error: "Failed to start exam attempt." } as const;
    }

    await supabaseAdmin.from("attempt_events").insert({
        attempt_id: created.id,
        event_type: "started",
        payload: { fingerprint: args.fingerprint || null, device_id: args.deviceId || null },
    });

    return { ok: true, attempt: created as AssessmentAttempt, reused: false } as const;
}

export async function loadAttempt(args: {
    assessmentId: string;
    attemptId: string;
    accessToken: string;
}) {
    const { data } = await supabaseAdmin
        .from("assessment_attempts")
        .select("*")
        .eq("assessment_id", args.assessmentId)
        .eq("id", args.attemptId)
        .eq("access_token", args.accessToken)
        .maybeSingle();

    return (data || null) as AssessmentAttempt | null;
}

export async function logAttemptEvent(args: {
    attemptId: string;
    eventType: string;
    payload: Record<string, unknown>;
}) {
    await supabaseAdmin.from("attempt_events").insert({
        attempt_id: args.attemptId,
        event_type: args.eventType,
        payload: args.payload,
    });
}

export async function saveAttemptAnswer(args: {
    attempt: AssessmentAttempt;
    questionId: string;
    answerText: string | null;
    selectedChoiceIds: string[];
    currentIndex: number;
}) {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("attempt_answers").upsert(
        {
            attempt_id: args.attempt.id,
            question_id: args.questionId,
            answer_text: args.answerText,
            selected_choice_ids: args.selectedChoiceIds,
            updated_at: now,
        },
        { onConflict: "attempt_id,question_id" },
    );

    if (error) {
        return false;
    }

    await supabaseAdmin
        .from("assessment_attempts")
        .update({ last_seen_at: now, current_index: Math.max(0, args.currentIndex), updated_at: now })
        .eq("id", args.attempt.id);
    await logAttemptEvent({
        attemptId: args.attempt.id,
        eventType: "autosaved",
        payload: { question_id: args.questionId, current_index: args.currentIndex },
    });
    return true;
}

export async function getAttemptPresentation(attempt: AssessmentAttempt) {
    const questions = await getPublishedExamQuestions(attempt.assessment_id);
    const { data: answersData } = await supabaseAdmin
        .from("attempt_answers")
        .select("attempt_id, question_id, answer_text, selected_choice_ids, is_correct, awarded_points, needs_manual_review")
        .eq("attempt_id", attempt.id);

    return {
        questions: buildAttemptPresentation({
            questions,
            questionOrder: (attempt.question_order || []) as string[],
            choiceOrder: (attempt.choice_order || {}) as Record<string, string[]>,
        }),
        answers: (answersData || []) as AttemptAnswer[],
        maxScore: calculateAttemptMaxScore(questions),
    };
}

export async function finalizeAttempt(args: {
    attempt: AssessmentAttempt;
    forcedStatus?: "submitted" | "timed_out";
}) {
    const questions = await getPublishedExamQuestions(args.attempt.assessment_id);
    const { data: answersData } = await supabaseAdmin
        .from("attempt_answers")
        .select("id, attempt_id, question_id, answer_text, selected_choice_ids, is_correct, awarded_points, needs_manual_review")
        .eq("attempt_id", args.attempt.id);
    const answers = (answersData || []) as AttemptAnswer[];
    const results = gradeAttemptAnswers({ questions, answers });
    const summary = calculateExamScoreSummary(results);
    const status = summary.requiresManualReview
        ? "pending_review"
        : (args.forcedStatus || "submitted");
    const finalScore = summary.requiresManualReview ? null : summary.autoGradedScore;
    const now = new Date().toISOString();

    for (const result of results) {
        await supabaseAdmin
            .from("attempt_answers")
            .update({
                is_correct: result.isCorrect,
                awarded_points: result.awardedPoints,
                needs_manual_review: result.needsManualReview,
                updated_at: now,
            })
            .eq("attempt_id", args.attempt.id)
            .eq("question_id", result.questionId);
    }

    await supabaseAdmin
        .from("assessment_attempts")
        .update({
            status,
            submitted_at: now,
            score: finalScore,
            max_score: calculateAttemptMaxScore(questions),
            auto_graded_score: summary.autoGradedScore,
            updated_at: now,
            last_seen_at: now,
        })
        .eq("id", args.attempt.id);

    await logAttemptEvent({
        attemptId: args.attempt.id,
        eventType: status === "timed_out" ? "timed_out" : "submitted",
        payload: { status, auto_graded_score: summary.autoGradedScore },
    });

    if (!summary.requiresManualReview) {
        await supabaseAdmin.from("coursework_grades").upsert(
            {
                assessment_id: args.attempt.assessment_id,
                student_id: args.attempt.student_id,
                score: summary.autoGradedScore,
                updated_at: now,
            },
            { onConflict: "assessment_id,student_id" },
        );
    }

    const { data: refreshed } = await supabaseAdmin
        .from("assessment_attempts")
        .select("*")
        .eq("id", args.attempt.id)
        .single();

    return refreshed as AssessmentAttempt;
}

export function isAttemptExpired(attempt: AssessmentAttempt) {
    return new Date(attempt.deadline_at).getTime() <= Date.now();
}

export function validateAttemptMutation(attempt: AssessmentAttempt) {
    if (attempt.status !== "in_progress") {
        return { ok: false, message: "This attempt is already finalized." };
    }
    if (isAttemptExpired(attempt)) {
        return { ok: false, message: "This attempt has expired." };
    }
    return { ok: true, message: "" };
}

export function shouldShowResults(attempt: AssessmentAttempt, config: AssessmentExamConfig | null) {
    return Boolean(config?.show_results_immediately && attempt.status !== "in_progress");
}


