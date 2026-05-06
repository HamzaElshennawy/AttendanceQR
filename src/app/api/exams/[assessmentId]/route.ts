import { NextResponse } from "next/server";
import {
    getAssessmentWithExamConfig,
    isExamAccessible,
    startExamAttempt,
} from "@/lib/exam-service";
import { getPublishedExamQuestions } from "@/lib/exam-service";
import { formatExamWindow } from "@/lib/exams";
import { requireFeature } from "@/lib/subscriptions";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ assessmentId: string }> },
) {
    const { assessmentId } = await params;
    const exam = await getAssessmentWithExamConfig(assessmentId);

    if (!exam) {
        return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }

    const feature = await requireFeature(exam.assessment.professor_id, "exams");
    if (!feature.ok) {
        return NextResponse.json(
            { error: "Exam access is not enabled on the current plan." },
            { status: 403 },
        );
    }

    const questions = await getPublishedExamQuestions(assessmentId);
    const access = isExamAccessible(exam.config);

    return NextResponse.json({
        assessment: {
            id: exam.assessment.id,
            title: exam.assessment.title,
            max_score: exam.assessment.max_score,
        },
        config: exam.config
            ? {
                  is_enabled: exam.config.is_enabled,
                  is_published: exam.config.is_published,
                  duration_minutes: exam.config.duration_minutes,
                  max_attempts: exam.config.max_attempts,
                  start_at: exam.config.start_at,
                  end_at: exam.config.end_at,
                  requires_access_code: Boolean(exam.config.access_code),
                  one_question_at_a_time: exam.config.one_question_at_a_time,
                  no_backtracking: exam.config.no_backtracking,
                  show_results_immediately: exam.config.show_results_immediately,
                  window_label: formatExamWindow(exam.config.start_at, exam.config.end_at),
              }
            : null,
        access,
        question_count: questions.length,
    });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ assessmentId: string }> },
) {
    const { assessmentId } = await params;
    const body = await request.json();

    if (!body?.university_id) {
        return NextResponse.json(
            { error: "University ID is required." },
            { status: 400 },
        );
    }

    const exam = await getAssessmentWithExamConfig(assessmentId);
    if (!exam) {
        return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }

    const feature = await requireFeature(exam.assessment.professor_id, "exams");
    if (!feature.ok) {
        return NextResponse.json(
            { error: "Exam access is not enabled on the current plan." },
            { status: 403 },
        );
    }

    const result = await startExamAttempt({
        assessmentId,
        universityId: String(body.university_id).trim(),
        accessCode: body.access_code ? String(body.access_code).trim() : null,
        fingerprint: body.fingerprint ? String(body.fingerprint) : null,
        deviceId: body.device_id ? String(body.device_id) : null,
    });

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
        attempt_id: result.attempt.id,
        access_token: result.attempt.access_token,
        deadline_at: result.attempt.deadline_at,
        status: result.attempt.status,
        reused: result.reused,
        current_index: result.attempt.current_index,
    });
}
