import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

// Use service role for token rotation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Fetch session
  const { data: session, error: fetchError } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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

  // Generate new token
  const newToken = crypto.randomBytes(16).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 30 * 1000).toISOString();

  // Update session with new token
  const { error: updateError } = await supabaseAdmin
    .from("sessions")
    .update({
      current_token: newToken,
      token_expires_at: tokenExpiresAt,
    })
    .eq("id", sessionId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update token" }, { status: 500 });
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
    token: newToken,
    expired: false,
    is_active: true,
    attendance_count: count || 0,
    total_students: totalStudents || 0,
    expires_at: session.expires_at,
  });
}
