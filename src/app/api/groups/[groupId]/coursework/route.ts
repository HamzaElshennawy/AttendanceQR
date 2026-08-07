import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const maxScore = Number(body.max_score);

    if (!title || !Number.isFinite(maxScore) || maxScore < 0) {
        return NextResponse.json(
            { error: "Title and a valid max score are required." },
            { status: 400 },
        );
    }

    const { data, error } = await supabaseAdmin
        .from("coursework_assessments")
        .insert({
            group_id: groupId,
            session_id: body.session_id ? String(body.session_id) : null,
            title,
            assessment_kind: String(body.assessment_kind || "quiz"),
            max_score: maxScore,
            category: body.category ? String(body.category) : null,
        })
        .select("id")
        .single();

    if (error || !data) {
        return NextResponse.json(
            { error: error?.message || "Failed to create coursework item." },
            { status: 500 },
        );
    }

    return NextResponse.json({ assessment: data });
}
