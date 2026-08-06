import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
    RATE_LIMITS,
    checkRateLimit,
    clientIp,
    tooManyRequests,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** Supabase's own floor is 6; this is a deliberate step up from that. */
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
    const ip = clientIp(request);

    const rate = await checkRateLimit(RATE_LIMITS.register, ip);
    if (!rate.allowed) {
        return tooManyRequests(
            rate,
            "Too many sign-up attempts. Please try again later.",
        );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const university = String(body.university || "").trim();

    if (!name || !email || !password) {
        return NextResponse.json(
            { error: "Name, email, and password are required" },
            { status: 400 },
        );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
            {
                error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
            },
            { status: 400 },
        );
    }

    // The anon client, deliberately — not the service role.
    //
    // This route used to call auth.admin.createUser with email_confirm: true,
    // which bypassed Supabase's signup protections and marked every address
    // verified without anyone proving they owned it. signUp() sends the
    // confirmation mail and honours the project's rate limits and captcha.
    //
    // The professors and professor_subscriptions rows are created by the
    // on_auth_user_created trigger, so there is no multi-step write here to
    // roll back by hand.
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name, university: university || null },
            emailRedirectTo: `${appBaseUrl()}/auth/callback`,
        },
    });

    if (error) {
        logger.warn("Sign-up failed", { email, message: error.message });

        return NextResponse.json(
            { error: error.message },
            { status: error.status || 400 },
        );
    }

    // Supabase returns a user with an empty identities array when the address is
    // already registered, so that a signup attempt cannot be used to discover
    // who has an account. Mirror that: report success either way.
    const alreadyRegistered = data.user?.identities?.length === 0;

    return NextResponse.json({
        success: true,
        // With email confirmation on there is no session yet, and the client
        // must not try to sign in immediately.
        requires_confirmation: !data.session,
        message:
            alreadyRegistered || !data.session
                ? "Check your inbox for a confirmation link to finish setting up your account."
                : "Account created.",
    });
}
