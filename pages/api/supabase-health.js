import { checkSupabaseService, getSupabaseConfig } from "../../lib/supabaseServer";

export default async function handler(req, res) {
  const result = await checkSupabaseService();
  let host = null;
  try {
    const { url } = getSupabaseConfig();
    host = url ? new URL(url).host : null;
  } catch {}
  res.status(result.ok ? 200 : 503).json({
    ...result,
    host,
  });
}
