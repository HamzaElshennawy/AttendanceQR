import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (access.role !== "owner") {
        return NextResponse.json(
            { error: "Only owners can rename groups." },
            { status: 403 },
        );
    }

    const { name } = await request.json();
    const normalizedName = String(name || "").trim();

    if (!normalizedName) {
        return NextResponse.json(
            { error: "Group name is required." },
            { status: 400 },
        );
    }

    const { error } = await supabaseAdmin
        .from("groups")
        .update({ name: normalizedName })
        .eq("id", groupId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (access.role !== "owner") {
        return NextResponse.json(
            { error: "Only owners can delete groups." },
            { status: 403 },
        );
    }

    const { error } = await supabaseAdmin.from("groups").delete().eq("id", groupId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
