import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type GroupRole = "owner" | "ta";

export interface GroupAccessResult {
    userId: string;
    role: GroupRole;
}

export async function requireGroupAccess(
    groupId: string,
): Promise<GroupAccessResult | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: group } = await supabaseAdmin
        .from("groups")
        .select("professor_id")
        .eq("id", groupId)
        .single();

    if (!group) {
        return null;
    }

    if (group.professor_id === user.id) {
        return { userId: user.id, role: "owner" };
    }

    const { data: membership } = await supabaseAdmin
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("professor_id", user.id)
        .single();

    if (!membership) {
        return null;
    }

    return {
        userId: user.id,
        role: membership.role as GroupRole,
    };
}

export async function requireSessionAccess(sessionId: string) {
    const { data: session } = await supabaseAdmin
        .from("sessions")
        .select("group_id")
        .eq("id", sessionId)
        .single();

    if (!session) {
        return null;
    }

    const access = await requireGroupAccess(session.group_id);
    if (!access) {
        return null;
    }

    return {
        ...access,
        groupId: session.group_id,
    };
}
