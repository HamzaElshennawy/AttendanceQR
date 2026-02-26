import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use service role to bypass RLS for attendance operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.json();
  const { session_id, university_id, token } = body;

  if (!session_id || !university_id || !token) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
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
    await supabaseAdmin
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
  const { data: student, error: studentError } = await supabaseAdmin
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
  const { data: existing } = await supabaseAdmin
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
  const { error: insertError } = await supabaseAdmin
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
