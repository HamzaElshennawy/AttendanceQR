import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ groupId: string; studentId: string }> },
) {
    const { groupId, studentId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, university_id } = await request.json();
    const normalizedName = String(name || "").trim();
    const normalizedUniversityId = String(university_id || "").trim();

    if (!normalizedName || !normalizedUniversityId) {
        return NextResponse.json(
            { error: "Student name and university ID are required." },
            { status: 400 },
        );
    }

    const { error } = await supabaseAdmin
        .from("students")
        .update({
            name: normalizedName,
            university_id: normalizedUniversityId,
        })
        .eq("id", studentId)
        .eq("group_id", groupId);

    if (error) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.code === "23505" ? 409 : 500 },
        );
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ groupId: string; studentId: string }> },
) {
    const { groupId, studentId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabaseAdmin
        .from("students")
        .delete()
        .eq("id", studentId)
        .eq("group_id", groupId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
