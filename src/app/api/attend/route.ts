import { NextResponse } from "next/server";
import { isCurrentSessionTokenValid } from "@/lib/attendance-security";
import { defaultGradingSettings, shouldAutoMarkLate } from "@/lib/grading-settings";
import { logger } from "@/lib/logger";
import {
    RATE_LIMITS,
    checkRateLimit,
    clientIp,
    tooManyRequests,
} from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = "23505";

/** Rejects NaN, Infinity, strings, and out-of-range coordinates. */
function parseCoordinate(value: unknown, max: number): number | null {
    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(parsed) || Math.abs(parsed) > max) {
        return null;
    }

    return parsed;
}

// Haversine formula to calculate distance between two coordinates in meters
function getDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const session_id = String(body.session_id || "").trim();
    const university_id = String(body.university_id || "").trim();
    const token = String(body.token || "").trim();
    const fingerprint = body.fingerprint ? String(body.fingerprint) : null;
    const device_id = body.device_id ? String(body.device_id) : null;

    if (!session_id || !university_id || !token) {
        return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 },
        );
    }

    const ip = clientIp(request);

    const rate = await checkRateLimit(RATE_LIMITS.attend, session_id, ip);
    if (!rate.allowed) {
        return tooManyRequests(
            rate,
            "Too many check-in attempts. Please wait a moment and try again.",
        );
    }

    // Coordinates are validated up front so a malformed value cannot reach the
    // Haversine maths and produce a NaN distance, which compares false against
    // every radius and would silently pass the geofence.
    const latitude = parseCoordinate(body.latitude, 90);
    const longitude = parseCoordinate(body.longitude, 180);

    // 1. Check session exists and is active
    const { data: session, error: sessionError } = await supabaseAdmin
        .from("sessions")
        .select("*")
        .eq("id", session_id)
        .maybeSingle();

    if (sessionError || !session) {
        return NextResponse.json(
            { error: "Session not found" },
            { status: 404 },
        );
    }

    if (!session.is_active) {
        return NextResponse.json(
            { error: "This session has ended" },
            { status: 400 },
        );
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
        await supabaseAdmin
            .from("sessions")
            .update({ is_active: false })
            .eq("id", session_id);
        return NextResponse.json(
            { error: "This session has expired" },
            { status: 400 },
        );
    }

    // 2. Validate token
    if (
        !isCurrentSessionTokenValid({
            currentToken: session.current_token,
            providedToken: token,
            tokenExpiresAt: session.token_expires_at,
        })
    ) {
        return NextResponse.json(
            {
                error: "QR code is invalid or expired. Please scan the current QR code on the screen.",
            },
            { status: 400 },
        );
    }

    // 3. Validate student exists in the group
    const { data: student } = await supabaseAdmin
        .from("students")
        .select("*")
        .eq("group_id", session.group_id)
        .eq("university_id", university_id)
        .maybeSingle();

    if (!student) {
        // A distinct "not in this class" message reveals who is enrolled to
        // anyone holding the QR token. Rather than blunt the message for the
        // student who simply mistyped their ID, misses are counted separately
        // and cut off quickly — enumeration needs many, a typo needs one.
        const failures = await checkRateLimit(
            RATE_LIMITS.attendFailure,
            session_id,
            ip,
        );

        if (!failures.allowed) {
            return tooManyRequests(
                failures,
                "Too many failed attempts. Please check with your instructor.",
            );
        }

        return NextResponse.json(
            {
                error: "Student ID not found in this class. Please check your ID and try again.",
            },
            { status: 400 },
        );
    }

    // 4. Location validation (if session has location set)
    if (session.latitude && session.longitude) {
        if (latitude == null || longitude == null) {
            return NextResponse.json(
                {
                    error: "Location access is required for this session. Please enable location and try again.",
                },
                { status: 400 },
            );
        }

        const distance = getDistanceMeters(
            session.latitude,
            session.longitude,
            latitude,
            longitude,
        );

        if (distance > (session.radius_meters || 100)) {
            // Log violation
            await supabaseAdmin.from("violations").insert({
                session_id,
                university_id,
                student_name: student.name,
                type: "out_of_range",
                details: {
                    student_lat: latitude,
                    student_lng: longitude,
                    session_lat: session.latitude,
                    session_lng: session.longitude,
                    distance_meters: Math.round(distance),
                    radius_meters: session.radius_meters || 100,
                },
            });

            return NextResponse.json(
                {
                    error: "You are outside the allowed area for this session. Your attempt has been recorded.",
                },
                { status: 400 },
            );
        }
    }

    // 5. Device duplicate check — layered: device_id = hard block, fingerprint = soft warning
    // 5a. Hard check: persistent device UUID (stored in browser localStorage + IndexedDB)
    if (device_id) {
        const { data: existingDeviceId } = await supabaseAdmin
            .from("attendance_records")
            .select("id, university_id")
            .eq("session_id", session_id)
            .eq("device_id", device_id)
            .maybeSingle();

        if (existingDeviceId && existingDeviceId.university_id !== university_id) {
            const { data: originalStudent } = await supabaseAdmin
                .from("students")
                .select("name")
                .eq("group_id", session.group_id)
                .eq("university_id", existingDeviceId.university_id)
                .maybeSingle();

            // Hard violation — same persistent device UUID, different student
            await supabaseAdmin.from("violations").insert({
                session_id,
                university_id,
                student_name: student.name,
                type: "duplicate_device",
                details: {
                    device_id,
                    original_student_id: existingDeviceId.university_id,
                    original_student_name: originalStudent?.name || "Unknown",
                    attempted_student_id: university_id,
                    attempted_student_name: student.name,
                    severity: "hard",
                },
            });

            return NextResponse.json(
                {
                    error: "This device has already been used to check in another student. Your attempt has been recorded.",
                },
                { status: 400 },
            );
        }
    }

    // 5b. Soft check: FingerprintJS visitorId (hardware-derived, may collide on identical devices)
    let softViolationLogged = false;
    if (fingerprint) {
        const { data: existingFingerprint } = await supabaseAdmin
            .from("attendance_records")
            .select("id, university_id")
            .eq("session_id", session_id)
            .eq("device_fingerprint", fingerprint)
            .maybeSingle();

        if (existingFingerprint && existingFingerprint.university_id !== university_id) {
            const { data: originalStudent } = await supabaseAdmin
                .from("students")
                .select("name")
                .eq("group_id", session.group_id)
                .eq("university_id", existingFingerprint.university_id)
                .maybeSingle();

            // Soft violation — log for professor review but allow check-in
            await supabaseAdmin.from("violations").insert({
                session_id,
                university_id,
                student_name: student.name,
                type: "duplicate_device_soft",
                details: {
                    fingerprint,
                    original_student_id: existingFingerprint.university_id,
                    original_student_name: originalStudent?.name || "Unknown",
                    attempted_student_id: university_id,
                    attempted_student_name: student.name,
                    severity: "soft",
                },
            });
            softViolationLogged = true;
        }
    }

    // 6. Check for duplicate attendance.
    //
    // Advisory only: two concurrent requests can both pass this before either
    // inserts. The unique index on (session_id, student_id) is the actual
    // guarantee, handled at the insert below. This check exists to return a
    // friendly message in the common, non-racing case.
    const { data: existing } = await supabaseAdmin
        .from("attendance_records")
        .select("id")
        .eq("session_id", session_id)
        .eq("student_id", student.id)
        .maybeSingle();

    if (existing) {
        return NextResponse.json(
            {
                error: "You have already checked in for this session.",
                already_checked_in: true,
            },
            { status: 400 },
        );
    }

    const { data: gradingSettings } = await supabaseAdmin
        .from("group_grading_settings")
        .select("late_after_minutes")
        .eq("group_id", session.group_id)
        .maybeSingle();

    const lateAfterMinutes =
        gradingSettings?.late_after_minutes == null
            ? defaultGradingSettings.late_after_minutes
            : Number(gradingSettings.late_after_minutes);

    const attendanceStatus = shouldAutoMarkLate(
        session.started_at,
        lateAfterMinutes,
    )
        ? "late"
        : "present";

    // 7. Record attendance (store both device_id and fingerprint)
    const { error: insertError } = await supabaseAdmin
        .from("attendance_records")
        .insert({
            session_id,
            student_id: student.id,
            university_id,
            status: attendanceStatus,
            device_fingerprint: fingerprint || null,
            device_id: device_id || null,
        });

    if (insertError) {
        // Lost the race against a concurrent check-in, or the same device tried
        // twice. Both are "already checked in", not a server error.
        if (insertError.code === UNIQUE_VIOLATION) {
            return NextResponse.json(
                {
                    error: "You have already checked in for this session.",
                    already_checked_in: true,
                },
                { status: 400 },
            );
        }

        logger.error("Failed to record attendance", {
            sessionId: session_id,
            error: insertError,
        });

        return NextResponse.json(
            { error: "Failed to record attendance. Please try again." },
            { status: 500 },
        );
    }

    const responseMessage = attendanceStatus === "late"
        ? "Attendance recorded as late."
        : "Attendance recorded successfully!";

    return NextResponse.json({
        success: true,
        student_name: student.name,
        message: softViolationLogged
            ? responseMessage + " (Note: A device similarity was flagged for review.)"
            : responseMessage,
        status: attendanceStatus,
    });
}
