import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: profile } = await supabaseAdmin
        .from("system_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

    if (!profile?.user_id) {
        return null;
    }

    return {
        userId: user.id,
    };
}
