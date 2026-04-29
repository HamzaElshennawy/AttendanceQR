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

    const quota = await checkQuota(access.userId, "sessionsThisMonth", 1);
    if (!quota.ok) {
        return NextResponse.json(
            { error: quota.message, code: "PLAN_LIMIT_REACHED" },
            { status: 403 },
        );
    }

    const body = await request.json();
    const durationMinutes = Math.max(1, Number(body.duration_minutes || 15));
    const sessionData: Record<string, unknown> = {
        group_id: groupId,
        title: body.title ? String(body.title).trim() : null,
        category: body.category === "tutorial" ? "tutorial" : "lecture",
        duration_minutes: durationMinutes,
        is_active: true,
        expires_at: String(body.expires_at || ""),
        qr_rotating: body.qr_rotating !== false,
        rotation_interval_seconds: Math.max(5, Number(body.rotation_interval_seconds || 15)),
    };

    if (body.latitude != null && body.longitude != null) {
        sessionData.latitude = Number(body.latitude);
        sessionData.longitude = Number(body.longitude);
        sessionData.radius_meters = Math.max(1, Number(body.radius_meters || 100));
    }

    const { data, error } = await supabaseAdmin
        .from("sessions")
        .insert(sessionData)
        .select("id")
        .single();

    if (error || !data) {
        return NextResponse.json(
            { error: error?.message || "Failed to create session." },
            { status: 500 },
        );
    }

    return NextResponse.json({ session: data });
}
