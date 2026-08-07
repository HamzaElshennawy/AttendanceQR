import { NextResponse } from "next/server";
import { requireSessionAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const access = await requireSessionAccess(sessionId);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("sessions")
    .update({ is_active: false })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
