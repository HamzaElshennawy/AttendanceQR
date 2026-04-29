import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { checkQuota } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: ownedGroups }, { data: memberships }] = await Promise.all([
        supabaseAdmin
            .from("groups")
            .select("id, name, created_at, professor_id")
            .eq("professor_id", user.id)
            .order("created_at", { ascending: false }),
        supabaseAdmin
            .from("group_memberships")
            .select("group_id, role")
            .eq("professor_id", user.id),
    ]);

    const membershipRoleByGroup = new Map(
        (memberships || []).map((membership) => [
            membership.group_id,
            membership.role as "owner" | "ta",
        ]),
    );

    const accessibleGroupIds = Array.from(
        new Set([
            ...(ownedGroups || []).map((group) => group.id),
            ...(memberships || []).map((membership) => membership.group_id),
        ]),
    );

    const { data: allGroups } = accessibleGroupIds.length
        ? await supabaseAdmin
              .from("groups")
              .select("id, name, created_at, professor_id")
              .in("id", accessibleGroupIds)
              .order("created_at", { ascending: false })
        : { data: [] as Array<{ id: string; name: string; created_at: string; professor_id: string }> };

    const groups = await Promise.all(
        (allGroups || []).map(async (group) => {
            const [{ count: studentCount }, { count: sessionCount }] =
                await Promise.all([
                    supabaseAdmin
                        .from("students")
                        .select("id", { count: "exact", head: true })
                        .eq("group_id", group.id),
                    supabaseAdmin
                        .from("sessions")
                        .select("id", { count: "exact", head: true })
                        .eq("group_id", group.id),
                ]);

            return {
                ...group,
                access_role:
                    group.professor_id === user.id
                        ? "owner"
                        : membershipRoleByGroup.get(group.id) || "ta",
                student_count: studentCount || 0,
                session_count: sessionCount || 0,
            };
        }),
    );

    return NextResponse.json({ groups });
}

export async function POST(request: Request) {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkQuota(user.id, "groups", 1);
    if (!quota.ok) {
        return NextResponse.json(
            { error: quota.message, code: "PLAN_LIMIT_REACHED" },
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

    const { data, error } = await supabaseAdmin
        .from("groups")
        .insert({
            professor_id: user.id,
            name: normalizedName,
        })
        .select("id, name, created_at, professor_id")
        .single();

    if (error || !data) {
        return NextResponse.json(
            { error: error?.message || "Failed to create group." },
            { status: 500 },
        );
    }

    return NextResponse.json({ group: data });
}
