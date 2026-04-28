import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
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

    const { upsertRows, deleteIds } = await request.json();

    if (Array.isArray(upsertRows) && upsertRows.length > 0) {
        const normalizedRows = upsertRows
            .map((row) => ({
                assessment_id: assessmentId,
                student_id: String(row.student_id || ""),
                score: Number(row.score),
            }))
            .filter(
                (row) =>
                    row.student_id &&
                    Number.isFinite(row.score) &&
                    row.score >= 0,
            );

        if (normalizedRows.length > 0) {
            const { error } = await supabaseAdmin
                .from("coursework_grades")
                .upsert(normalizedRows, {
                    onConflict: "assessment_id,student_id",
                });

            if (error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 },
                );
            }
        }
    }

    if (Array.isArray(deleteIds) && deleteIds.length > 0) {
        const ids = deleteIds
            .map((id) => String(id || ""))
            .filter(Boolean);

        if (ids.length > 0) {
            const { error } = await supabaseAdmin
                .from("coursework_grades")
                .delete()
                .in("id", ids);

            if (error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 },
                );
            }
        }
    }

    return NextResponse.json({ success: true });
}
