import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SearchResultType = "group" | "student" | "session" | "coursework";

interface SearchResultItem {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle: string;
    href: string;
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
    }

    const [{ data: ownedGroups }, { data: memberships }] = await Promise.all([
        supabaseAdmin
            .from("groups")
            .select("id")
            .eq("professor_id", user.id),
        supabaseAdmin
            .from("group_memberships")
            .select("group_id")
            .eq("professor_id", user.id),
    ]);

    const accessibleGroupIds = Array.from(
        new Set([
            ...(ownedGroups || []).map((group) => group.id),
            ...(memberships || []).map((membership) => membership.group_id),
        ]),
    );

    if (!accessibleGroupIds.length) {
        return NextResponse.json({ results: [] });
    }

    const pattern = `%${q}%`;

    const [accessibleGroupsRes, groupsRes, studentsRes, sessionsRes, courseworkRes] = await Promise.all([
        supabaseAdmin
            .from("groups")
            .select("id, name")
            .in("id", accessibleGroupIds),
        supabaseAdmin
            .from("groups")
            .select("id, name")
            .in("id", accessibleGroupIds)
            .ilike("name", pattern)
            .limit(8),
        supabaseAdmin
            .from("students")
            .select("id, name, university_id, group_id")
            .in("group_id", accessibleGroupIds)
            .or(`name.ilike.${pattern},university_id.ilike.${pattern}`)
            .limit(10),
        supabaseAdmin
            .from("sessions")
            .select("id, title, category, group_id")
            .in("group_id", accessibleGroupIds)
            .or(`title.ilike.${pattern},category.ilike.${pattern}`)
            .limit(10),
        supabaseAdmin
            .from("coursework_assessments")
            .select("id, title, assessment_kind, group_id")
            .in("group_id", accessibleGroupIds)
            .or(`title.ilike.${pattern},assessment_kind.ilike.${pattern}`)
            .limit(10),
    ]);

    const groupNameById = new Map(
        (accessibleGroupsRes.data || []).map((group) => [group.id, group.name]),
    );

    const results: SearchResultItem[] = [
        ...((groupsRes.data || []).map((group) => ({
            id: group.id,
            type: "group" as const,
            title: group.name,
            subtitle: "Group",
            href: `/dashboard/groups/${group.id}`,
        })) as SearchResultItem[]),
        ...((studentsRes.data || []).map((student) => ({
            id: student.id,
            type: "student" as const,
            title: student.name,
            subtitle: `${student.university_id} · ${groupNameById.get(student.group_id) || "Group"}`,
            href: `/dashboard/groups/${student.group_id}/students/${student.id}`,
        })) as SearchResultItem[]),
        ...((sessionsRes.data || []).map((session) => ({
            id: session.id,
            type: "session" as const,
            title: session.title || "Untitled Session",
            subtitle: `${session.category === "lecture" ? "Lecture" : "Tutorial"} · ${groupNameById.get(session.group_id) || "Group"}`,
            href: `/dashboard/groups/${session.group_id}/sessions/${session.id}`,
        })) as SearchResultItem[]),
        ...((courseworkRes.data || []).map((assessment) => ({
            id: assessment.id,
            type: "coursework" as const,
            title: assessment.title,
            subtitle: `${assessment.assessment_kind} · ${groupNameById.get(assessment.group_id) || "Group"}`,
            href: `/dashboard/groups/${assessment.group_id}?tab=coursework`,
        })) as SearchResultItem[]),
    ];

    return NextResponse.json({ results: results.slice(0, 24) });
}
