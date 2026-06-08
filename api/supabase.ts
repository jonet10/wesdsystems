import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!serviceRoleKey) {
  console.warn(
    "[api/supabase] ⚠️  SUPABASE_SERVICE_ROLE_KEY is missing! " +
    "Falling back to anon key — RLS will NOT be bypassed. " +
    "Add the service role key in Vercel Environment Variables."
  );
}

const supabaseKey =
  serviceRoleKey ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables for API routes");
}

export const apiSupabase = createClient(supabaseUrl, supabaseKey);

export function createClientWithAuth(authToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${authToken}` } },
  });
}

