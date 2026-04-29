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

    const { students } = await request.json();

    if (!Array.isArray(students) || students.length === 0) {
        return NextResponse.json(
            { error: "At least one student is required." },
            { status: 400 },
        );
    }

    const normalizedStudents = students
        .map((student) => ({
            group_id: groupId,
            name: String(student?.name || "").trim(),
            university_id: String(student?.university_id || "").trim(),
        }))
        .filter((student) => student.name && student.university_id);

    if (!normalizedStudents.length) {
        return NextResponse.json(
            { error: "No valid students were provided." },
            { status: 400 },
        );
    }

    const quota = await checkQuota(access.userId, "students", normalizedStudents.length);
    if (!quota.ok) {
        return NextResponse.json(
            { error: quota.message, code: "PLAN_LIMIT_REACHED" },
            { status: 403 },
        );
    }

    let success = 0;
    let skipped = 0;

    for (const student of normalizedStudents) {
        const { error } = await supabaseAdmin.from("students").insert(student);
        if (error) {
            skipped += 1;
        } else {
            success += 1;
        }
    }

    return NextResponse.json({ success, skipped });
}
