import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv, supabaseServiceRoleKey } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — server-only, never import from a
 * component that ships to the browser.
 *
 * Constructed lazily behind a proxy. It used to be built at module scope, so a
 * missing key threw during import and surfaced as an unrelated module-resolution
 * error at startup rather than a named missing-variable error at the point of
 * use. The proxy keeps the existing `supabaseAdmin.from(...)` call sites intact.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
    if (!client) {
        client = createClient(supabaseEnv().url, supabaseServiceRoleKey());
    }

    return client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, property) {
        const instance = getClient();
        const value = Reflect.get(instance, property, instance);

        return typeof value === "function" ? value.bind(instance) : value;
    },
});

export function getSupabaseAdmin() {
    return getClient();
}
