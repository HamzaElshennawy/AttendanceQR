import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Use service role for token rotation
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;

    // Fetch session
    const { data: session, error: fetchError } = await supabaseAdmin
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

    if (fetchError || !session) {
        return NextResponse.json(
            { error: "Session not found" },
            { status: 404 },
        );
    }

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
        await supabaseAdmin
            .from("sessions")
            .update({ is_active: false })
            .eq("id", sessionId);

        return NextResponse.json({
            expired: true,
            is_active: false,
            token: null,
        });
    }

    if (!session.is_active) {
        return NextResponse.json({
            expired: true,
            is_active: false,
            token: null,
        });
    }

    // Handle token based on rotation setting
    const isRotating = session.qr_rotating !== false;
    const intervalSeconds = session.rotation_interval_seconds || 15;

    let currentToken: string;

    if (!isRotating && session.current_token) {
        // Static QR: reuse existing token, just extend expiry
        currentToken = session.current_token;
        const tokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour expiry for static
        await supabaseAdmin
            .from("sessions")
            .update({ token_expires_at: tokenExpiresAt })
            .eq("id", sessionId);
    } else {
        // Rotating QR: generate new token
        currentToken = crypto.randomBytes(16).toString("hex");
        const tokenExpiresAt = new Date(
            Date.now() + (intervalSeconds + 15) * 1000,
        ).toISOString();

        const { error: updateError } = await supabaseAdmin
            .from("sessions")
            .update({
                current_token: currentToken,
                token_expires_at: tokenExpiresAt,
            })
            .eq("id", sessionId);

        if (updateError) {
            return NextResponse.json(
                { error: "Failed to update token" },
                { status: 500 },
            );
        }
    }

    // Get attendance count
    const { count } = await supabaseAdmin
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);

    // Get total students in group
    const { count: totalStudents } = await supabaseAdmin
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("group_id", session.group_id);

    return NextResponse.json({
        token: currentToken,
        expired: false,
        is_active: true,
        attendance_count: count || 0,
        total_students: totalStudents || 0,
        expires_at: session.expires_at,
    });
}
