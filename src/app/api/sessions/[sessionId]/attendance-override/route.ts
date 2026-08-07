import { NextResponse } from "next/server";
import { requireSessionAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;
    const access = await requireSessionAccess(sessionId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentId, status, note } = await request.json();

    if (
        !studentId ||
        !status ||
        !["present", "excused", "late"].includes(status)
    ) {
        return NextResponse.json(
            { error: "Student and a valid status are required." },
            { status: 400 },
        );
    }

    const { data: student } = await supabaseAdmin
        .from("students")
        .select("id, university_id, group_id")
        .eq("id", studentId)
        .single();

    if (!student || student.group_id !== access.groupId) {
        return NextResponse.json(
            { error: "Student not found in this group." },
            { status: 404 },
        );
    }

    const { data: existing } = await supabaseAdmin
        .from("attendance_records")
        .select("id, recorded_via")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .maybeSingle();

    if (existing?.recorded_via === "qr") {
        return NextResponse.json(
            {
                error: "QR check-ins cannot be replaced. Manual override is only for absent or manually recorded students.",
            },
            { status: 400 },
        );
    }

    const payload = {
        session_id: sessionId,
        student_id: studentId,
        university_id: student.university_id,
        status,
        recorded_via: "manual",
        note: note?.trim() || null,
        overridden_by: access.userId,
        updated_at: new Date().toISOString(),
    };

    const { error } = existing
        ? await supabaseAdmin
              .from("attendance_records")
              .update(payload)
              .eq("id", existing.id)
        : await supabaseAdmin.from("attendance_records").insert(payload);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
