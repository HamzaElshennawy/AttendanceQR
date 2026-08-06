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

/**
 * The user whose plan quota a group's resources count against — always the
 * group owner, never the acting user.
 *
 * Usage is measured over groups where `professor_id = userId`, so charging the
 * acting user meant a TA's activity counted against nobody: they own no groups,
 * so their snapshot is empty and every quota check passed regardless of the
 * owner's plan.
 */
export async function resolveQuotaOwner(groupId: string): Promise<string | null> {
    const { data: group } = await supabaseAdmin
        .from("groups")
        .select("professor_id")
        .eq("id", groupId)
        .single();

    return group?.professor_id ?? null;
}

export interface GroupAccessWithOwner extends GroupAccessResult {
    /** Group owner's user id — the account plan limits are charged against. */
    ownerId: string;
}

/**
 * Group access plus the owner to bill quota against.
 *
 * Note `role: "owner"` is not sufficient on its own: a co-owner added through
 * group_memberships also reports that role but is not the group's
 * `professor_id`, so their own plan would be charged instead of the owner's.
 */
export async function requireGroupAccessWithOwner(
    groupId: string,
): Promise<GroupAccessWithOwner | null> {
    const access = await requireGroupAccess(groupId);

    if (!access) {
        return null;
    }

    const ownerId = await resolveQuotaOwner(groupId);

    if (!ownerId) {
        return null;
    }

    return { ...access, ownerId };
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
