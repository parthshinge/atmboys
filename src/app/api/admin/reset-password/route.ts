import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { id, newPassword } = (await request.json()) as {
    id?: string;
    newPassword?: string;
  };

  if (!id || !newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "id and a newPassword of at least 6 characters are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: newPassword });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
