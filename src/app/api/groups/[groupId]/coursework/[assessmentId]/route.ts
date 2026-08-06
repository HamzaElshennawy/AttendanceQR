import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ groupId: string; assessmentId: string }> },
) {
    const { groupId, assessmentId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (access.role !== "owner") {
        // Teaching assistants run sessions and enter grades, but destructive
        // deletes stay with the group owner.
        return NextResponse.json(
            { error: "Only the group owner can delete this." },
            { status: 403 },
        );
    }

    const { error } = await supabaseAdmin
        .from("coursework_assessments")
        .delete()
        .eq("id", assessmentId)
        .eq("group_id", groupId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
