import { createSupabaseServiceClient } from "../../lib/supabaseServer";
export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = req.body || {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (body.consent !== true) return res.status(400).json({ error: "Please agree to receive waitlist updates." });
  if (body.website) return res.status(400).json({ error: "Unable to accept this signup." });
  const bounded = (value) => typeof value === "string" ? value.slice(0, 200) : null;
  try {
    const db = createSupabaseServiceClient();
    const { error } = await db.from("pick_waitlist").upsert({
      email, consent_version: "pick-availability-v1",
      page_path: bounded(body.page_path), utm_source: bounded(body.utm_source),
      utm_medium: bounded(body.utm_medium), utm_campaign: bounded(body.utm_campaign),
      utm_content: bounded(body.utm_content),
    }, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch {
    console.error("Pick waitlist storage failed");
    return res.status(503).json({ error: "We couldn't save your email. Please try again." });
  }
}
