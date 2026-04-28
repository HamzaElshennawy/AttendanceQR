import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { checkQuota } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ImportedAttendanceStatus = "present" | "late" | "excused";

interface ImportedSessionPayload {
    title?: string;
    category: "lecture" | "tutorial";
    sessionDate: string;
    entries: { studentId: string; status: ImportedAttendanceStatus }[];
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessions } = await request.json();

    if (!Array.isArray(sessions) || sessions.length === 0) {
        return NextResponse.json(
            { error: "At least one session import definition is required." },
            { status: 400 },
        );
    }

    const normalizedSessions = sessions.filter(
        (session: unknown): session is ImportedSessionPayload =>
            Boolean(session) &&
            typeof session === "object" &&
            ["lecture", "tutorial"].includes(
                String((session as { category?: string }).category),
            ) &&
            typeof (session as { sessionDate?: string }).sessionDate === "string" &&
            Array.isArray((session as { entries?: unknown[] }).entries),
    );

    if (normalizedSessions.length === 0) {
        return NextResponse.json(
            { error: "No valid session definitions were provided." },
            { status: 400 },
        );
    }

    const quota = await checkQuota(access.userId, "sessionsThisMonth", normalizedSessions.length);
    if (!quota.ok) {
        return NextResponse.json(
            { error: quota.message, code: "PLAN_LIMIT_REACHED" },
            { status: 403 },
        );
    }

    const allStudentIds = Array.from(
        new Set(
            normalizedSessions.flatMap((session) =>
                session.entries.map((entry) => entry.studentId),
            ),
        ),
    );

    const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, university_id")
        .eq("group_id", groupId)
        .in("id", allStudentIds);

    const studentById = new Map(
        (students || []).map((student) => [student.id, student]),
    );

    const createdSessionIds: string[] = [];
    let importedCount = 0;

    for (const importedSession of normalizedSessions) {
        const normalizedDate = new Date(importedSession.sessionDate);
        if (Number.isNaN(normalizedDate.getTime())) {
            continue;
        }

        const validEntries = importedSession.entries
            .filter(
                (
                    entry,
                ): entry is {
                    studentId: string;
                    status: ImportedAttendanceStatus;
                } =>
                    Boolean(entry) &&
                    typeof entry.studentId === "string" &&
                    ["present", "late", "excused"].includes(entry.status),
            )
            .map((entry) => {
                const student = studentById.get(entry.studentId);
                if (!student) {
                    return null;
                }

                return {
                    student_id: student.id,
                    university_id: student.university_id,
                    status: entry.status,
                };
            })
            .filter(
                (
                    entry,
                ): entry is {
                    student_id: string;
                    university_id: string;
                    status: ImportedAttendanceStatus;
                } => entry !== null,
            );

        if (validEntries.length === 0) {
            continue;
        }

        const expiresAt = new Date(normalizedDate.getTime() + 60 * 60 * 1000);

        const { data: session, error: sessionError } = await supabaseAdmin
            .from("sessions")
            .insert({
                group_id: groupId,
                title: importedSession.title?.trim() || null,
                category: importedSession.category,
                duration_minutes: 60,
                is_active: false,
                started_at: normalizedDate.toISOString(),
                expires_at: expiresAt.toISOString(),
            })
            .select("id")
            .single();

        if (sessionError || !session) {
            for (const createdSessionId of createdSessionIds) {
                await supabaseAdmin.from("sessions").delete().eq("id", createdSessionId);
            }

            return NextResponse.json(
                { error: sessionError?.message || "Failed to create session." },
                { status: 500 },
            );
        }

        createdSessionIds.push(session.id);

        const { error: attendanceError } = await supabaseAdmin
            .from("attendance_records")
            .insert(
                validEntries.map((entry) => ({
                    session_id: session.id,
                    student_id: entry.student_id,
                    university_id: entry.university_id,
                    scanned_at: normalizedDate.toISOString(),
                    status: entry.status,
                    recorded_via: "manual",
                    note: "Imported from historical attendance sheet",
                    overridden_by: access.userId,
                    updated_at: new Date().toISOString(),
                })),
            );

        if (attendanceError) {
            for (const createdSessionId of createdSessionIds) {
                await supabaseAdmin.from("sessions").delete().eq("id", createdSessionId);
            }

            return NextResponse.json(
                { error: attendanceError.message },
                { status: 500 },
            );
        }

        importedCount += validEntries.length;
    }

    if (createdSessionIds.length === 0) {
        return NextResponse.json(
            { error: "No valid attendance sessions could be imported." },
            { status: 400 },
        );
    }

    return NextResponse.json({
        success: true,
        sessionCount: createdSessionIds.length,
        importedCount,
    });
}
