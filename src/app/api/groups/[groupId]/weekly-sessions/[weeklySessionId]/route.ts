import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

function normalizeWeeklySessionBody(body: Record<string, unknown>) {
    const title = String(body.title || "").trim();
    const dayOfWeek = Number(body.day_of_week);
    const startTime = String(body.start_time || "").trim();
    const durationMinutes = Math.max(1, Number(body.duration_minutes || 15));
    const rotationIntervalSeconds = Math.max(
        5,
        Number(body.rotation_interval_seconds || 15),
    );
    const radiusMeters = Math.max(1, Number(body.radius_meters || 100));

    return {
        title,
        category: body.category === "tutorial" ? "tutorial" : "lecture",
        day_of_week: dayOfWeek,
        start_time: startTime,
        duration_minutes: durationMinutes,
        qr_rotating: body.qr_rotating !== false,
        rotation_interval_seconds: rotationIntervalSeconds,
        require_location: body.require_location === true,
        radius_meters: radiusMeters,
        is_enabled: body.is_enabled !== false,
        updated_at: new Date().toISOString(),
    };
}

function validateWeeklySession(session: ReturnType<typeof normalizeWeeklySessionBody>) {
    if (!session.title) {
        return "Session title is required.";
    }

    if (!Number.isInteger(session.day_of_week) || session.day_of_week < 0 || session.day_of_week > 6) {
        return "Day of week must be between Sunday and Saturday.";
    }

    if (!/^\d{2}:\d{2}$/.test(session.start_time)) {
        return "Start time must use HH:MM format.";
    }

    return null;
}

export async function PATCH(
    request: Request,
    {
        params,
    }: { params: Promise<{ groupId: string; weeklySessionId: string }> },
) {
    const { groupId, weeklySessionId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalized = normalizeWeeklySessionBody(await request.json());
    const validationError = validateWeeklySession(normalized);

    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from("group_weekly_sessions")
        .update(normalized)
        .eq("id", weeklySessionId)
        .eq("group_id", groupId)
        .select(
            "id, group_id, title, category, day_of_week, start_time, duration_minutes, qr_rotating, rotation_interval_seconds, require_location, radius_meters, is_enabled, created_at, updated_at",
        )
        .single();

    if (error || !data) {
        return NextResponse.json(
            { error: error?.message || "Failed to update weekly session." },
            { status: 500 },
        );
    }

    return NextResponse.json({ weeklySession: data });
}

export async function DELETE(
    _request: Request,
    {
        params,
    }: { params: Promise<{ groupId: string; weeklySessionId: string }> },
) {
    const { groupId, weeklySessionId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabaseAdmin
        .from("group_weekly_sessions")
        .delete()
        .eq("id", weeklySessionId)
        .eq("group_id", groupId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
