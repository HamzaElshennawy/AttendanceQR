import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use service role key to bypass RLS for professor profile creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { name, email, password, university } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  // 1. Create auth user
  const { data, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm so they can log in immediately
  });

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }

  // 2. Create professor profile (bypasses RLS with service role)
  const { error: profileError } = await supabaseAdmin.from("professors").insert({
    id: data.user.id,
    name,
    email,
    university: university || null,
  });

  if (profileError) {
    // Clean up: delete the auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
