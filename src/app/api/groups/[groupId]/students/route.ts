import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { checkQuota } from "@/lib/subscriptions";
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

    const quota = await checkQuota(access.userId, "students", 1);
    if (!quota.ok) {
        return NextResponse.json(
            { error: quota.message, code: "PLAN_LIMIT_REACHED" },
            { status: 403 },
        );
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

    const { data, error } = await supabaseAdmin
        .from("students")
        .insert({
            group_id: groupId,
            name: normalizedName,
            university_id: normalizedUniversityId,
        })
        .select("id, name, university_id")
        .single();

    if (error) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.code === "23505" ? 409 : 500 },
        );
    }

    return NextResponse.json({ student: data });
}
