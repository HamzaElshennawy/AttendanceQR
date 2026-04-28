import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { requireFeature } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    {
        params,
    }: { params: Promise<{ groupId: string; assessmentId: string }> },
) {
    const { groupId, assessmentId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feature = await requireFeature(access.userId, "exams");
    if (!feature.ok) {
        return NextResponse.json(
            {
                error: "Upgrade to Pro to manage exam questions.",
                code: "PLAN_FEATURE_REQUIRED",
            },
            { status: 403 },
        );
    }

    const { questions } = await request.json();

    if (!Array.isArray(questions)) {
        return NextResponse.json(
            { error: "Questions payload is required." },
            { status: 400 },
        );
    }

    const { error: deleteError } = await supabaseAdmin
        .from("assessment_questions")
        .delete()
        .eq("assessment_id", assessmentId);

    if (deleteError) {
        return NextResponse.json(
            { error: deleteError.message },
            { status: 500 },
        );
    }

    if (questions.length === 0) {
        return NextResponse.json({ success: true });
    }

    const questionRows = questions.map((question, index) => ({
        id: String(question.id || ""),
        assessment_id: assessmentId,
        prompt: String(question.prompt || "").trim(),
        description: question.description
            ? String(question.description).trim()
            : null,
        question_type: String(question.question_type || "multiple_choice"),
        points: Number(question.points || 0),
        position: index,
        is_required: Boolean(question.is_required),
        is_published: Boolean(question.is_published),
        answer_text: question.answer_text
            ? String(question.answer_text).trim()
            : null,
        updated_at: new Date().toISOString(),
    }));

    const { error: questionError } = await supabaseAdmin
        .from("assessment_questions")
        .insert(questionRows);

    if (questionError) {
        return NextResponse.json(
            { error: questionError.message },
            { status: 500 },
        );
    }

    const choiceRows = questions.flatMap((question) =>
        question.question_type === "multiple_choice" ||
        question.question_type === "true_false"
            ? (Array.isArray(question.choices) ? question.choices : []).map(
                  (choice: Record<string, unknown>, index: number) => ({
                      id: String(choice.id || ""),
                      question_id: String(question.id || ""),
                      label: String(choice.label || "").trim(),
                      position: index,
                      is_correct: Boolean(choice.is_correct),
                  }),
              )
            : [],
    );

    if (choiceRows.length > 0) {
        const { error: choiceError } = await supabaseAdmin
            .from("question_choices")
            .insert(choiceRows);

        if (choiceError) {
            return NextResponse.json(
                { error: choiceError.message },
                { status: 500 },
            );
        }
    }

    return NextResponse.json({ success: true });
}
