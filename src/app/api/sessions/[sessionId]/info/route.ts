import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;

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
