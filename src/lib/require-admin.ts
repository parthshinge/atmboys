import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, status: 401, message: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, message: "Admin access required" };
  }

  return { ok: true as const };
}
