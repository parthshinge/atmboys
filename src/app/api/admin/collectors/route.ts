import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = await request.json();
  const { email, password, full_name } = body as {
    email?: string;
    password?: string;
    full_name?: string;
  };

  if (!email || !password || !full_name) {
    return NextResponse.json(
      { error: "email, password, and full_name are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create user" },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin.from("users").insert({
    id: created.user.id,
    full_name,
    role: "collector",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from("users").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
