import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getCurrentEntitlements } from "@/lib/subscriptions";

export async function GET() {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const entitlements = await getCurrentEntitlements(user.id);
        return NextResponse.json(entitlements);
    } catch (error) {
        // Previously uncaught. A throw here — a missing column after an
        // unapplied migration, a Supabase outage — became a bare 500 with an
        // empty body, and every caller does `await response.json()`, so the
        // parse threw before any of them could handle the failure. The billing
        // panel's loading flag is cleared after that line, which left the whole
        // settings page spinning forever on what should have been one failed
        // request. Always answer with JSON.
        logger.error("Failed to resolve billing entitlements", {
            userId: user.id,
            error,
        });

        return NextResponse.json(
            { error: "Could not load billing information." },
            { status: 500 },
        );
    }
}
