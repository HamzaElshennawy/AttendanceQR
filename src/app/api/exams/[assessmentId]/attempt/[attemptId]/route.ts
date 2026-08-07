import { NextResponse } from "next/server";
import {
    finalizeAttempt,
    getAssessmentWithExamConfig,
    getAttemptPresentation,
    loadAttempt,
    logAttemptEvent,
    saveAttemptAnswer,
    shouldShowResults,
    validateAttemptMutation,
} from "@/lib/exam-service";
import { isClientReportableEvent, redactAnswerGrading } from "@/lib/exams";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ assessmentId: string; attemptId: string }> },
) {
    const { assessmentId, attemptId } = await params;
    const accessToken = new URL(request.url).searchParams.get("access_token") || "";
    if (!accessToken) {
        return NextResponse.json({ error: "Access token is required." }, { status: 400 });
    }

    const attempt = await loadAttempt({ assessmentId, attemptId, accessToken });
    if (!attempt) {
        return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const exam = await getAssessmentWithExamConfig(assessmentId);
    if (!exam) {
        return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }

    const finalAttempt =
        attempt.status === "in_progress" && new Date(attempt.deadline_at).getTime() <= Date.now()
            ? await finalizeAttempt({ attempt, forcedStatus: "timed_out" })
            : attempt;
    const presentation = await getAttemptPresentation(finalAttempt);
    const showResults = shouldShowResults(finalAttempt, exam.config);

    return NextResponse.json({
        attempt: {
            id: finalAttempt.id,
            status: finalAttempt.status,
            student_name: finalAttempt.student_name,
            university_id: finalAttempt.university_id,
            deadline_at: finalAttempt.deadline_at,
            started_at: finalAttempt.started_at,
            current_index: finalAttempt.current_index,
            score: showResults ? finalAttempt.score : null,
            auto_graded_score: showResults ? finalAttempt.auto_graded_score : null,
            max_score: finalAttempt.max_score,
        },
        config: exam.config,
        questions: presentation.questions,
        // Gated server-side. The client also checks `show_results`, but that
        // decides what is drawn, not what is sent.
        answers: showResults
            ? presentation.answers
            : redactAnswerGrading(presentation.answers),
        show_results: showResults,
    });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ assessmentId: string; attemptId: string }> },
) {
    const { assessmentId, attemptId } = await params;
    const body = await request.json();
    const action = String(body?.action || "");
    const accessToken = String(body?.access_token || "");

    if (!accessToken) {
        return NextResponse.json({ error: "Access token is required." }, { status: 400 });
    }

    const attempt = await loadAttempt({ assessmentId, attemptId, accessToken });
    if (!attempt) {
        return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (action === "event") {
        const eventType = String(body.event_type || "");

        // Unrecognised types are dropped rather than rejected: a client that is
        // a version behind should not see errors for an event we no longer
        // record, and a 400 here would tell a prober which names are accepted.
        if (isClientReportableEvent(eventType)) {
            await logAttemptEvent({
                attemptId: attempt.id,
                eventType,
                // The client-supplied payload is not spread in. It was
                // unbounded and unvalidated, so the proctoring log could be
                // filled with arbitrary JSON by the student being proctored.
                // Only the two fields the client legitimately reports are kept.
                payload: {
                    current_index: Number(body.current_index || attempt.current_index || 0),
                    fingerprint: body.fingerprint ? String(body.fingerprint).slice(0, 128) : null,
                },
            });
        }

        return NextResponse.json({ success: true });
    }

    const validation = validateAttemptMutation(attempt);
    if (!validation.ok) {
        const finalAttempt = new Date(attempt.deadline_at).getTime() <= Date.now()
            ? await finalizeAttempt({ attempt, forcedStatus: "timed_out" })
            : attempt;
        return NextResponse.json({ error: validation.message, status: finalAttempt.status }, { status: 400 });
    }

    if (action === "save") {
        if (!body.question_id) {
            return NextResponse.json({ error: "Question is required." }, { status: 400 });
        }

        const ok = await saveAttemptAnswer({
            attempt,
            questionId: String(body.question_id),
            answerText: body.answer_text == null ? null : String(body.answer_text),
            selectedChoiceIds: Array.isArray(body.selected_choice_ids)
                ? body.selected_choice_ids.map((item: unknown) => String(item))
                : [],
            currentIndex: Number(body.current_index || 0),
        });

        if (!ok) {
            return NextResponse.json({ error: "Failed to save answer." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    if (action === "submit") {
        const finalAttempt = await finalizeAttempt({ attempt, forcedStatus: "submitted" });

        // Same gate as the GET. Without it, turning off "show results
        // immediately" was pointless: the submit response handed back the score
        // the instructor had chosen to withhold.
        const exam = await getAssessmentWithExamConfig(assessmentId);
        const showResults = shouldShowResults(finalAttempt, exam?.config ?? null);

        return NextResponse.json({
            success: true,
            status: finalAttempt.status,
            score: showResults ? finalAttempt.score : null,
            auto_graded_score: showResults ? finalAttempt.auto_graded_score : null,
            max_score: finalAttempt.max_score,
            show_results: showResults,
        });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
