import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const { session_id, university_id, token } = body;

  if (!session_id || !university_id || !token) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // 1. Check session exists and is active
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", session_id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (!session.is_active) {
    return NextResponse.json(
      { error: "This session has ended" },
      { status: 400 }
    );
  }

  // Check if session expired
  if (new Date(session.expires_at) < new Date()) {
    await supabase
      .from("sessions")
      .update({ is_active: false })
      .eq("id", session_id);
    return NextResponse.json(
      { error: "This session has expired" },
      { status: 400 }
    );
  }

  // 2. Validate token (check current token or allow within grace period)
  if (session.current_token !== token) {
    // Check if token_expires_at hasn't passed (grace period for recently rotated tokens)
    // We'll be lenient — if the token was valid within the last 30 seconds
    const tokenExpiry = new Date(session.token_expires_at);
    const now = new Date();

    if (now > tokenExpiry) {
      return NextResponse.json(
        { error: "QR code has expired. Please scan the current QR code on the screen." },
        { status: 400 }
      );
    }
  }

  // 3. Validate student exists in the group
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
    .eq("group_id", session.group_id)
    .eq("university_id", university_id)
    .single();

  if (studentError || !student) {
    return NextResponse.json(
      { error: "Student ID not found in this class. Please check your ID and try again." },
      { status: 400 }
    );
  }

  // 4. Check for duplicate attendance
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("session_id", session_id)
    .eq("student_id", student.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "You have already checked in for this session.", already_checked_in: true },
      { status: 400 }
    );
  }

  // 5. Record attendance
  const { error: insertError } = await supabase
    .from("attendance_records")
    .insert({
      session_id,
      student_id: student.id,
      university_id,
    });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to record attendance. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    student_name: student.name,
    message: "Attendance recorded successfully!",
  });
}
