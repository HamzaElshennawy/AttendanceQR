import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getCurrentEntitlements } from "@/lib/subscriptions";

export async function GET() {
    const user = await requireAuthenticatedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entitlements = await getCurrentEntitlements(user.id);
    return NextResponse.json(entitlements);
}
