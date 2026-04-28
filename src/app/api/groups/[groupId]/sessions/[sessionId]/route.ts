import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ groupId: string; sessionId: string }> },
) {
    const { groupId, sessionId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("id", sessionId)
        .eq("group_id", groupId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
