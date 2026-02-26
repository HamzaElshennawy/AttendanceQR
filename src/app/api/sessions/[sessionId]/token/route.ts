import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();

  // Fetch session
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Check if session has expired
  if (new Date(session.expires_at) < new Date()) {
    // Auto-close expired session
    await supabase
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
  const tokenExpiresAt = new Date(Date.now() + 30 * 1000).toISOString(); // 30 second grace period

  // Update session with new token
  const { error: updateError } = await supabase
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
  const { count } = await supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  // Get total students in group
  const { count: totalStudents } = await supabase
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
