import { formatCourseworkScore } from "@/lib/coursework";

export type ExamQuestionType = "multiple_choice" | "true_false";

export type ExamAttemptStatus =
    | "in_progress"
    | "submitted"
    | "timed_out"
    | "pending_review";

export type ExamEventType =
    | "started"
    | "autosaved"
    | "tab_hidden"
    | "window_blur"
    | "refresh"
    | "reconnected"
    | "duplicate_session_detected"
    | "submitted"
    | "timed_out";

export interface AssessmentExamConfig {
    assessment_id: string;
    group_id: string;
    is_enabled: boolean;
    is_published: boolean;
    start_at: string | null;
    end_at: string | null;
    duration_minutes: number;
    max_attempts: number;
    shuffle_questions: boolean;
    shuffle_choices: boolean;
    one_question_at_a_time: boolean;
    no_backtracking: boolean;
    show_results_immediately: boolean;
    require_session_attendance: boolean;
    access_code: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface AssessmentQuestion {
    id: string;
    assessment_id: string;
    prompt: string;
    description: string | null;
    question_type: ExamQuestionType;
    points: number;
    position: number;
    is_required: boolean;
    is_published: boolean;
    answer_text: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface QuestionChoice {
    id: string;
    question_id: string;
    label: string;
    position: number;
    is_correct: boolean;
}

export interface AssessmentAttempt {
    id: string;
    assessment_id: string;
    student_id: string;
    university_id: string;
    student_name: string;
    status: ExamAttemptStatus;
    attempt_number: number;
    started_at: string;
    deadline_at: string;
    submitted_at: string | null;
    last_seen_at: string;
    current_index: number;
    access_token: string;
    question_order: string[];
    choice_order: Record<string, string[]>;
    device_fingerprint: string | null;
    device_id: string | null;
    score: number | null;
    max_score: number;
    auto_graded_score: number | null;
}

export interface AttemptAnswer {
    id?: string;
    attempt_id: string;
    question_id: string;
    answer_text: string | null;
    selected_choice_ids: string[];
    is_correct: boolean | null;
    awarded_points: number | null;
    needs_manual_review: boolean;
    updated_at?: string;
}

export interface AttemptEvent {
    id?: string;
    attempt_id: string;
    event_type: ExamEventType;
    payload: Record<string, unknown>;
    created_at?: string;
}

export interface ExamQuestionSnapshot extends AssessmentQuestion {
    choices: QuestionChoice[];
}

export interface PublicExamQuestion {
    id: string;
    prompt: string;
    description: string | null;
    question_type: ExamQuestionType;
    points: number;
    position: number;
    is_required: boolean;
    choices: Array<Pick<QuestionChoice, "id" | "label" | "position">>;
}

export interface GradeAnswerResult {
    questionId: string;
    isCorrect: boolean | null;
    awardedPoints: number | null;
    needsManualReview: boolean;
}

export const examQuestionTypeOptions: Array<{
    value: ExamQuestionType;
    label: string;
}> = [
    { value: "multiple_choice", label: "Multiple Choice" },
    { value: "true_false", label: "True / False" },
    //{ value: "short_answer", label: "Short Answer" },
    //{ value: "essay", label: "Essay" },
];

function toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeExamConfig(
    value?: Partial<AssessmentExamConfig> | Record<string, unknown> | null,
): AssessmentExamConfig {
    return {
        assessment_id:
            typeof value?.assessment_id === "string" ? value.assessment_id : "",
        group_id: typeof value?.group_id === "string" ? value.group_id : "",
        is_enabled: Boolean(value?.is_enabled),
        is_published: Boolean(value?.is_published),
        start_at: typeof value?.start_at === "string" ? value.start_at : null,
        end_at: typeof value?.end_at === "string" ? value.end_at : null,
        duration_minutes: Math.max(
            1,
            Math.round(toNumber(value?.duration_minutes, 30)),
        ),
        max_attempts: Math.max(1, Math.round(toNumber(value?.max_attempts, 1))),
        shuffle_questions: value?.shuffle_questions !== false,
        shuffle_choices: value?.shuffle_choices !== false,
        one_question_at_a_time: Boolean(value?.one_question_at_a_time),
        no_backtracking: Boolean(value?.no_backtracking),
        show_results_immediately: Boolean(value?.show_results_immediately),
        require_session_attendance: Boolean(value?.require_session_attendance),
        access_code:
            typeof value?.access_code === "string" &&
            value.access_code.trim().length > 0
                ? value.access_code.trim()
                : null,
    };
}

export function normalizeExamQuestion(
    value?: Partial<AssessmentQuestion> | Record<string, unknown> | null,
    index = 0,
): AssessmentQuestion {
    return {
        id: typeof value?.id === "string" ? value.id : crypto.randomUUID(),
        assessment_id:
            typeof value?.assessment_id === "string" ? value.assessment_id : "",
        prompt: typeof value?.prompt === "string" ? value.prompt : "",
        description:
            typeof value?.description === "string" ? value.description : null,
        question_type:
            value?.question_type === "true_false"
                ? value.question_type
                : "multiple_choice",
        points: Math.max(0, toNumber(value?.points, 1)),
        position: Math.max(0, Math.round(toNumber(value?.position, index))),
        is_required: value?.is_required !== false,
        is_published: value?.is_published !== false,
        answer_text:
            typeof value?.answer_text === "string" &&
            value.answer_text.trim().length > 0
                ? value.answer_text.trim()
                : null,
    };
}

export function normalizeQuestionChoice(
    value?: Partial<QuestionChoice> | Record<string, unknown> | null,
    questionId = "",
    index = 0,
): QuestionChoice {
    return {
        id: typeof value?.id === "string" ? value.id : crypto.randomUUID(),
        question_id:
            typeof value?.question_id === "string"
                ? value.question_id
                : questionId,
        label: typeof value?.label === "string" ? value.label : "",
        position: Math.max(0, Math.round(toNumber(value?.position, index))),
        is_correct: Boolean(value?.is_correct),
    };
}

export function getDefaultChoicesForQuestionType(type: ExamQuestionType) {
    if (type === "true_false") {
        return [
            {
                id: crypto.randomUUID(),
                question_id: "",
                label: "True",
                position: 0,
                is_correct: true,
            },
            {
                id: crypto.randomUUID(),
                question_id: "",
                label: "False",
                position: 1,
                is_correct: false,
            },
        ] satisfies QuestionChoice[];
    }

    if (type === "multiple_choice") {
        return [0, 1, 2, 3].map((position) => ({
            id: crypto.randomUUID(),
            question_id: "",
            label: `Choice ${position + 1}`,
            position,
            is_correct: position === 0,
        }));
    }

    return [] as QuestionChoice[];
}

export function formatExamQuestionType(type: ExamQuestionType) {
    return (
        examQuestionTypeOptions.find((option) => option.value === type)
            ?.label ?? type
    );
}

export function isObjectiveQuestion(type: ExamQuestionType) {
    return type === "multiple_choice" || type === "true_false";
}

export function sortQuestions<T extends { position: number }>(questions: T[]) {
    return [...questions].sort((a, b) => a.position - b.position);
}

export function shuffleArray<T>(items: T[]) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
}

export function buildAttemptPresentation(args: {
    questions: ExamQuestionSnapshot[];
    questionOrder: string[];
    choiceOrder: Record<string, string[]>;
}) {
    const { questions, questionOrder, choiceOrder } = args;
    const questionMap = new Map(
        questions.map((question) => [question.id, question]),
    );

    return questionOrder
        .map((questionId) => {
            const question = questionMap.get(questionId);
            if (!question) return null;
            const orderedChoices = choiceOrder[question.id]?.length
                ? choiceOrder[question.id]
                      .map((choiceId) =>
                          question.choices.find(
                              (choice) => choice.id === choiceId,
                          ),
                      )
                      .filter((choice): choice is QuestionChoice =>
                          Boolean(choice),
                      )
                : sortQuestions(question.choices);

            return {
                id: question.id,
                prompt: question.prompt,
                description: question.description,
                question_type: question.question_type,
                points: question.points,
                position: question.position,
                is_required: question.is_required,
                choices: orderedChoices.map((choice) => ({
                    id: choice.id,
                    label: choice.label,
                    position: choice.position,
                })),
            } satisfies PublicExamQuestion;
        })
        .filter((question): question is PublicExamQuestion =>
            Boolean(question),
        );
}

/**
 * Event types a student's browser is allowed to report.
 *
 * The attempt endpoint previously logged whatever `event_type` string arrived,
 * so the proctoring trail was writable by whoever held the access token — the
 * student being proctored. The risk is not junk rows: `tab_hidden` and
 * `window_blur` are the signals an instructor reviews for cheating, and anyone
 * could bury them under thousands of forged entries, or fabricate a `submitted`
 * event that never happened.
 *
 * `started`, `submitted`, `timed_out`, and `duplicate_session_detected` are
 * deliberately absent: those are written by the server when it observes the
 * thing itself, and must never be assertable by the client.
 */
export const CLIENT_REPORTABLE_EVENT_TYPES = new Set<ExamEventType>([
    "autosaved",
    "tab_hidden",
    "window_blur",
    "refresh",
    "reconnected",
]);

export function isClientReportableEvent(value: string): value is ExamEventType {
    return CLIENT_REPORTABLE_EVENT_TYPES.has(value as ExamEventType);
}

/**
 * Strips per-question grading from saved answers.
 *
 * `show_results_immediately` was enforced only in the client: the attempt
 * response carried `is_correct` and `awarded_points` for every answer whatever
 * the setting said, and the page merely chose not to render them. Reading them
 * took one look at the network tab. On a multi-attempt exam that also handed a
 * student the answer key for their next try.
 *
 * The student's own submitted answer is deliberately kept — it is their work,
 * and the page redisplays it. Only the marking is removed.
 */
export function redactAnswerGrading(answers: AttemptAnswer[]): AttemptAnswer[] {
    return answers.map((answer) => ({
        ...answer,
        is_correct: null,
        awarded_points: null,
        // Whether a question is queued for manual review says which ones were
        // not auto-marked, so it goes too.
        needs_manual_review: false,
    }));
}

export function calculateAttemptMaxScore(
    questions: Pick<AssessmentQuestion, "points">[],
) {
    return questions.reduce(
        (sum, question) => sum + Number(question.points || 0),
        0,
    );
}

export function gradeAttemptAnswers(args: {
    questions: ExamQuestionSnapshot[];
    answers: AttemptAnswer[];
}) {
    const { questions, answers } = args;
    const answerMap = new Map(
        answers.map((answer) => [answer.question_id, answer]),
    );
    const results: GradeAnswerResult[] = [];

    for (const question of questions) {
        const answer = answerMap.get(question.id);
        if (!answer) {
            results.push({
                questionId: question.id,
                isCorrect: isObjectiveQuestion(question.question_type)
                    ? false
                    : null,
                awardedPoints: isObjectiveQuestion(question.question_type)
                    ? 0
                    : null,
                needsManualReview: !isObjectiveQuestion(question.question_type),
            });
            continue;
        }

        if (
            question.question_type === "multiple_choice" ||
            question.question_type === "true_false"
        ) {
            const correctChoiceIds = question.choices
                .filter((choice) => choice.is_correct)
                .map((choice) => choice.id)
                .sort();
            const selectedChoiceIds = [
                ...(answer.selected_choice_ids || []),
            ].sort();
            const isCorrect =
                correctChoiceIds.length === selectedChoiceIds.length &&
                correctChoiceIds.every(
                    (choiceId, index) => selectedChoiceIds[index] === choiceId,
                );

            results.push({
                questionId: question.id,
                isCorrect,
                awardedPoints: isCorrect ? question.points : 0,
                needsManualReview: false,
            });
            continue;
        }

        results.push({
            questionId: question.id,
            isCorrect: null,
            awardedPoints: null,
            needsManualReview: true,
        });
    }

    return results;
}

export function calculateExamScoreSummary(results: GradeAnswerResult[]) {
    const autoGradedScore = results.reduce(
        (sum, result) => sum + Number(result.awardedPoints || 0),
        0,
    );
    const requiresManualReview = results.some(
        (result) => result.needsManualReview,
    );

    return {
        autoGradedScore,
        requiresManualReview,
    };
}

export function formatExamWindow(startAt: string | null, endAt: string | null) {
    if (!startAt && !endAt) {
        return "Always open";
    }

    const start = startAt
        ? new Date(startAt).toLocaleString("en-US")
        : "Any time";
    const end = endAt ? new Date(endAt).toLocaleString("en-US") : "No deadline";
    return `${start} to ${end}`;
}

export function formatAttemptScore(score: number | null, maxScore: number) {
    if (score == null) {
        return `Pending / ${formatCourseworkScore(maxScore)}`;
    }
    return `${formatCourseworkScore(score)} / ${formatCourseworkScore(maxScore)}`;
}
