import crypto from "crypto";
import { getServerUser } from "../../lib/authServer";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const user = await getServerUser(req, res);
  if (!user?.email) {
    return res.status(401).json({ ok: false, error: "auth_required" });
  }
  if (!hasSupabaseServiceConfig()) {
    return res.status(200).json({ ok: false, error: "supabase_not_configured" });
  }

  try {
    const supabase = createSupabaseServiceClient();
    if (req.method === "GET") {
      const { data } = await supabase
        .from("telegram_link_codes")
        .select("code,expires_at,used_at")
        .eq("user_id", user.id)
        .is("used_at", null)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) return res.status(200).json(payload(data[0]));
    }

    const code = await createCode(supabase, user);
    return res.status(200).json(payload(code));
  } catch (error) {
    return res.status(200).json({ ok: false, error: String(error?.message || error) });
  }
}

async function createCode(supabase, user) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const { error } = await supabase.from("telegram_link_codes").insert({
      code,
      user_id: user.id,
      email: String(user.email || "").toLowerCase(),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (!error) return { code, expires_at: expiresAt };
    if (!String(error.message || "").includes("duplicate")) throw error;
  }
  throw new Error("code_generation_failed");
}

function payload(row) {
  return {
    ok: true,
    code: row.code,
    expires_at: row.expires_at,
    command: `/link ${row.code}`,
  };
}
