import { NextResponse } from "next/server";
import { requireGroupAccessWithOwner } from "@/lib/group-access";
import { checkQuota } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** A session is a class, not a semester. Also caps the sessions quota's value. */
const MAX_SESSION_MINUTES = 24 * 60;

function parseCoordinate(value: unknown, max: number): number | null {
    const parsed = typeof value === "number" ? value : Number(value);

    return Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : null;
}

/**
 * Session expiry, bounded.
 *
 * `expires_at` was written straight from the request body with no validation,
 * so a client could set an arbitrarily distant expiry and keep a check-in
 * window — and its rotating QR token — open indefinitely. The client's value is
 * still honoured when it is sane, since the UI computes it, but it is clamped
 * to the session duration's natural end and can never exceed a day.
 */
function resolveExpiry(value: unknown, durationMinutes: number): string {
    const now = Date.now();
    const ceiling = now + MAX_SESSION_MINUTES * 60_000;
    const fallback = now + durationMinutes * 60_000;

    const requested = value ? new Date(String(value)).getTime() : Number.NaN;

    if (!Number.isFinite(requested)) {
        return new Date(fallback).toISOString();
    }

    // At least a minute out, never more than the ceiling.
    return new Date(
        Math.min(ceiling, Math.max(now + 60_000, requested)),
    ).toISOString();
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccessWithOwner(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await checkQuota(access.ownerId, "sessionsThisMonth", 1);
    if (!quota.ok) {
        return NextResponse.json(
            { error: quota.message, code: "PLAN_LIMIT_REACHED" },
            { status: 403 },
        );
    }

    const body = await request.json().catch(() => ({}));
    const durationMinutes = Math.min(
        MAX_SESSION_MINUTES,
        Math.max(1, Number(body.duration_minutes || 15)),
    );

    const sessionData: Record<string, unknown> = {
        group_id: groupId,
        title: body.title ? String(body.title).trim() : null,
        category: body.category === "tutorial" ? "tutorial" : "lecture",
        duration_minutes: durationMinutes,
        is_active: true,
        expires_at: resolveExpiry(body.expires_at, durationMinutes),
        qr_rotating: body.qr_rotating !== false,
        rotation_interval_seconds: Math.min(
            3600,
            Math.max(5, Number(body.rotation_interval_seconds || 15)),
        ),
    };

    const latitude = parseCoordinate(body.latitude, 90);
    const longitude = parseCoordinate(body.longitude, 180);

    if (latitude !== null && longitude !== null) {
        sessionData.latitude = latitude;
        sessionData.longitude = longitude;
        sessionData.radius_meters = Math.min(
            100_000,
            Math.max(1, Number(body.radius_meters || 100)),
        );
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
