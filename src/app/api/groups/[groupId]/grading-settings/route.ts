import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { normalizeGradingSettings } from "@/lib/grading-settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabaseAdmin
        .from("group_grading_settings")
        .select(
            "present_grade, late_grade, excused_grade, absent_grade, late_after_minutes",
        )
        .eq("group_id", groupId)
        .maybeSingle();

    return NextResponse.json({ settings: normalizeGradingSettings(data) });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const { groupId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalized = normalizeGradingSettings(await request.json());

    const { error } = await supabaseAdmin
        .from("group_grading_settings")
        .upsert(
            {
                group_id: groupId,
                ...normalized,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "group_id" },
        );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: normalized });
}
