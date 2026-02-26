import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use service role to bypass RLS for attendance operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    const body = await request.json();
    const {
        session_id,
        university_id,
        token,
        latitude,
        longitude,
        fingerprint,
    } = body;

    if (!session_id || !university_id || !token) {
        return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 },
        );
    }

    // 1. Check session exists and is active
    const { data: session, error: sessionError } = await supabaseAdmin
        .from("sessions")
        .select("*")
        .eq("id", session_id)
        .single();

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
    if (session.current_token !== token) {
        const tokenExpiry = new Date(session.token_expires_at);
        const now = new Date();

        if (now > tokenExpiry) {
            return NextResponse.json(
                {
                    error: "QR code has expired. Please scan the current QR code on the screen.",
                },
                { status: 400 },
            );
        }
    }

    // 3. Validate student exists in the group
    const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .select("*")
        .eq("group_id", session.group_id)
        .eq("university_id", university_id)
        .single();

    if (studentError || !student) {
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

    // 5. Device fingerprint check
    if (fingerprint) {
        const { data: existingDevice } = await supabaseAdmin
            .from("attendance_records")
            .select("id, university_id")
            .eq("session_id", session_id)
            .eq("device_fingerprint", fingerprint)
            .single();

        if (existingDevice && existingDevice.university_id !== university_id) {
            // Same device, different student — log violation
            await supabaseAdmin.from("violations").insert({
                session_id,
                university_id,
                student_name: student.name,
                type: "duplicate_device",
                details: {
                    fingerprint,
                    original_student_id: existingDevice.university_id,
                    attempted_student_id: university_id,
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

    // 6. Check for duplicate attendance
    const { data: existing } = await supabaseAdmin
        .from("attendance_records")
        .select("id")
        .eq("session_id", session_id)
        .eq("student_id", student.id)
        .single();

    if (existing) {
        return NextResponse.json(
            {
                error: "You have already checked in for this session.",
                already_checked_in: true,
            },
            { status: 400 },
        );
    }

    // 7. Record attendance
    const { error: insertError } = await supabaseAdmin
        .from("attendance_records")
        .insert({
            session_id,
            student_id: student.id,
            university_id,
            device_fingerprint: fingerprint || null,
        });

    if (insertError) {
        return NextResponse.json(
            { error: "Failed to record attendance. Please try again." },
            { status: 500 },
        );
    }

    return NextResponse.json({
        success: true,
        student_name: student.name,
        message: "Attendance recorded successfully!",
    });
}
