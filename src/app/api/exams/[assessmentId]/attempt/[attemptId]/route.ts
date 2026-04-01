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
        answers: presentation.answers,
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
        if (body.event_type) {
            await logAttemptEvent({
                attemptId: attempt.id,
                eventType: String(body.event_type),
                payload: {
                    ...(body.payload || {}),
                    current_index: Number(body.current_index || attempt.current_index || 0),
                    fingerprint: body.fingerprint || null,
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
        return NextResponse.json({
            success: true,
            status: finalAttempt.status,
            score: finalAttempt.score,
            auto_graded_score: finalAttempt.auto_graded_score,
            max_score: finalAttempt.max_score,
        });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
