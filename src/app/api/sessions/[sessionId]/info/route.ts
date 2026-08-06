import { NextResponse } from "next/server";
import { requireSessionAccess } from "@/lib/group-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;
    const access = await requireSessionAccess(sessionId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: session } = await supabaseAdmin
        .from("sessions")
        .select("latitude, longitude, radius_meters")
        .eq("id", sessionId)
        .single();

    if (!session) {
        return NextResponse.json(
            { error: "Session not found" },
            { status: 404 },
        );
    }

    return NextResponse.json({
        has_location: !!(session.latitude && session.longitude),
        radius_meters: session.radius_meters || 100,
    });
}
