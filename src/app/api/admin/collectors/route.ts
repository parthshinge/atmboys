import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import type { UserRole } from "@/types/database";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = await request.json();
  const { email, password, full_name, role } = body as {
    email?: string;
    password?: string;
    full_name?: string;
    role?: UserRole;
  };

  const targetRole: UserRole = role === "admin" ? "admin" : "collector";

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
    user_metadata: {
      full_name,
      role: targetRole,
    },
  });

  if (createError || !created.user) {
    const errMsg = createError?.message ?? "Failed to create user";
    const isDuplicateEmail =
      errMsg.toLowerCase().includes("already registered") ||
      errMsg.toLowerCase().includes("already exists") ||
      errMsg.toLowerCase().includes("email_exists");

    if (isDuplicateEmail) {
      // Check if user exists in auth.users but lacks a public.users profile
      const { data: listData } = await admin.auth.admin.listUsers();
      const existingUser = listData.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        const { data: existingProfile } = await admin
          .from("users")
          .select("id")
          .eq("id", existingUser.id)
          .maybeSingle();

        if (!existingProfile) {
          // Repair missing profile
          const { error: repairError } = await admin.from("users").upsert(
            {
              id: existingUser.id,
              full_name,
              role: targetRole,
              is_active: true,
              full_report_access: targetRole === "admin",
            },
            { onConflict: "id" }
          );

          if (repairError) {
            return NextResponse.json({ error: repairError.message }, { status: 400 });
          }

          return NextResponse.json({
            id: existingUser.id,
            message: "Missing profile repaired for existing user.",
          });
        }
      }

      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  // Ensure public.users profile is updated / populated cleanly (upsert prevents duplicate key errors if trigger already ran)
  const { error: profileError } = await admin.from("users").upsert(
    {
      id: created.user.id,
      full_name,
      role: targetRole,
      is_active: true,
      full_report_access: targetRole === "admin",
    },
    { onConflict: "id" }
  );

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
