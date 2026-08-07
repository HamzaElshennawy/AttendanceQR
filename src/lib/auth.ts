import { createClient } from "@/lib/supabase/server";

export interface AuthenticatedUser {
    id: string;
    email: string | null;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email ?? null,
    };
}
