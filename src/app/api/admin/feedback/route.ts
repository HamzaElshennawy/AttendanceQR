import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function enrichFeedbackRows(
    feedback: {
        professor_id: string;
        [key: string]: unknown;
    }[],
) {
    const professorIds = [...new Set(feedback.map((entry) => entry.professor_id))];

    const { data: professors } =
        professorIds.length > 0
            ? await supabaseAdmin
                  .from("professors")
                  .select("id, name, email")
                  .in("id", professorIds)
            : { data: [] };

    const professorById = new Map(
        (professors || []).map((professor) => [professor.id, professor]),
    );

    return feedback.map((entry) => ({
        ...entry,
        professor_name: professorById.get(entry.professor_id)?.name || "Unknown",
        professor_email: professorById.get(entry.professor_id)?.email || "",
    }));
}

export async function GET() {
    const admin = await requireAdmin();

    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: feedback } = await supabaseAdmin
        .from("feedback_entries")
        .select("*")
        .order("created_at", { ascending: false });

    const enriched = await enrichFeedbackRows(feedback || []);

    return NextResponse.json({ feedback: enriched });
}

export async function PATCH(request: Request) {
    const admin = await requireAdmin();

    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status } = await request.json();

    if (!id || !status || !["submitted", "reviewed", "planned"].includes(status)) {
        return NextResponse.json(
            { error: "Feedback id and valid status are required." },
            { status: 400 },
        );
    }

    const { error } = await supabaseAdmin
        .from("feedback_entries")
        .update({ status })
        .eq("id", id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export { enrichFeedbackRows };
