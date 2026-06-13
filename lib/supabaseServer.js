import { createClient } from "@supabase/supabase-js";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return { url: url.replace(/\/$/, ""), serviceRole, anon };
}

export function hasSupabaseServiceConfig() {
  const { url, serviceRole } = getSupabaseConfig();
  return Boolean(url && serviceRole);
}

export function createSupabaseServiceClient() {
  const { url, serviceRole } = getSupabaseConfig();
  if (!url || !serviceRole) {
    throw new Error("Supabase service config missing");
  }
  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function checkSupabaseService() {
  if (!hasSupabaseServiceConfig()) {
    return { ok: false, configured: false, error: "missing_config" };
  }
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("pipeline_runs").select("cycle_id", { count: "exact", head: true });
    if (error) return { ok: false, configured: true, error: error.message };
    return { ok: true, configured: true };
  } catch (error) {
    return { ok: false, configured: true, error: error?.message || String(error) };
  }
}
