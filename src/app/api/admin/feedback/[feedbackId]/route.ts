import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enrichFeedbackRows } from "@/app/api/admin/feedback/route";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ feedbackId: string }> },
) {
    const admin = await requireAdmin();

    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { feedbackId } = await params;

    const { data: feedback } = await supabaseAdmin
        .from("feedback_entries")
        .select("*")
        .eq("id", feedbackId)
        .single();

    if (!feedback) {
        return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    const [enriched] = await enrichFeedbackRows([feedback]);

    return NextResponse.json({ feedback: enriched });
}
