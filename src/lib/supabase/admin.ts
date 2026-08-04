import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for privileged server-only operations (creating
 * collector auth accounts, deleting users). NEVER import this in a
 * client component. Instantiated lazily inside request handlers so a
 * missing env var never breaks the build.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
