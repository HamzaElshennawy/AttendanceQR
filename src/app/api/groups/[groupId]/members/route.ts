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

    if (access.role !== "owner") {
        return NextResponse.json(
            { error: "Only owners can manage team members." },
            { status: 403 },
        );
    }

    const { email, role } = await request.json();

    if (!email || !role || !["owner", "ta"].includes(role)) {
        return NextResponse.json(
            { error: "Email and a valid role are required." },
            { status: 400 },
        );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: professor } = await supabaseAdmin
        .from("professors")
        .select("id, email, name")
        .eq("email", normalizedEmail)
        .single();

    if (!professor) {
        return NextResponse.json(
            { error: "No existing Quorum account was found for that email." },
            { status: 404 },
        );
    }

    const { data: group } = await supabaseAdmin
        .from("groups")
        .select("professor_id")
        .eq("id", groupId)
        .single();

    if (!group) {
        return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    if (group.professor_id === professor.id) {
        return NextResponse.json(
            { error: "The primary owner already has full access." },
            { status: 400 },
        );
    }

    if (professor.id === access.userId && role === "owner") {
        return NextResponse.json(
            { error: "You are already the owner of this group." },
            { status: 400 },
        );
    }

    const { error } = await supabaseAdmin.from("group_memberships").upsert(
        {
            group_id: groupId,
            professor_id: professor.id,
            role,
        },
        {
            onConflict: "group_id,professor_id",
        },
    );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: group }, { data: memberships }] = await Promise.all([
        supabaseAdmin
            .from("groups")
            .select("professor_id")
            .eq("id", groupId)
            .single(),
        supabaseAdmin
            .from("group_memberships")
            .select("professor_id, role")
            .eq("group_id", groupId),
    ]);

    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const professorIds = [
        group.professor_id,
        ...(memberships || []).map((member) => member.professor_id),
    ];

    const { data: profiles } = await supabaseAdmin
        .from("professors")
        .select("id, name, email")
        .in("id", professorIds);

    const profileById = new Map(
        (profiles || []).map((profile) => [profile.id, profile]),
    );

    const team = [
        {
            professor_id: group.professor_id,
            role: "owner",
        },
        ...(memberships || []).filter(
            (member) => member.professor_id !== group.professor_id,
        ),
    ]
        .map((member) => {
            const profile = profileById.get(member.professor_id);
            if (!profile) return null;

            return {
                professor_id: profile.id,
                name: profile.name,
                email: profile.email,
                role: member.role,
            };
        })
        .filter(Boolean);

    return NextResponse.json({ team });
}

export async function DELETE(
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
            { error: "Only owners can remove team members." },
            { status: 403 },
        );
    }

    const { professorId } = await request.json();

    if (!professorId) {
        return NextResponse.json(
            { error: "Professor ID is required." },
            { status: 400 },
        );
    }

    const { error } = await supabaseAdmin
        .from("group_memberships")
        .delete()
        .eq("group_id", groupId)
        .eq("professor_id", professorId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
