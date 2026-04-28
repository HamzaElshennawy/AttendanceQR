import { NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/group-access";
import { requireFeature } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    {
        params,
    }: { params: Promise<{ groupId: string; assessmentId: string }> },
) {
    const { groupId, assessmentId } = await params;
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feature = await requireFeature(access.userId, "exams");
    if (!feature.ok) {
        return NextResponse.json(
            {
                error: "Upgrade to Pro to manage exam settings.",
                code: "PLAN_FEATURE_REQUIRED",
            },
            { status: 403 },
        );
    }

    const { config } = await request.json();

    if (!config || typeof config !== "object") {
        return NextResponse.json(
            { error: "Exam config is required." },
            { status: 400 },
        );
    }

    const { error } = await supabaseAdmin
        .from("assessment_exam_configs")
        .upsert(
            {
                ...config,
                assessment_id: assessmentId,
                group_id: groupId,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "assessment_id" },
        );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
