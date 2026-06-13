import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../../utils/email";
import { tgSendMessage } from "../../utils/tg";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { email, sport_interest, utm_source, utm_medium, utm_campaign, referrer } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const ref_code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { error: upsertErr } = await supabase.from("leads").upsert(
    {
      email,
      sport_interest: sport_interest || "all",
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      referrer: referrer || null,
      ref_code,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (upsertErr) {
    console.error(upsertErr);
    return res.status(500).json({ error: "Failed to save email" });
  }

  try {
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;line-height:1.55;color:#0f172a;">
        <h2>Welcome to SharpSignal</h2>
        <p>You are now on the list. Expect transparent pick previews, dashboard updates, and performance recaps.</p>
        <p>SharpSignal is built around timestamped picks, graded results, and visible model health.</p>
        <p>
          <a href="https://www.sharps-signal.com/picks-preview"
             style="display:inline-block;margin-top:16px;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">
            View the picks preview
          </a>
        </p>
        <p>
          <a href="https://www.sharps-signal.com/signup?next=%2Fpicks"
             style="display:inline-block;margin-top:8px;padding:12px 18px;background:#10b981;color:#0f172a;text-decoration:none;border-radius:6px;font-weight:bold;">
            Create your dashboard login
          </a>
        </p>
      </div>`;

    await sendEmail({
      from: process.env.RESEND_FROM || "SharpSignal <onboarding@resend.dev>",
      to: email,
      subject: "Welcome to SharpSignal",
      html,
    });
  } catch (err) {
    console.error("Email error:", err);
  }

  try {
    const lines = [
      "New signup",
      email,
      `Sport: ${sport_interest || "all"}`,
      `UTM: ${utm_source || "-"}/${utm_medium || "-"}/${utm_campaign || "-"}`,
      referrer ? `Referrer: ${referrer}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await tgSendMessage(process.env.FOUNDER_TG_CHAT_ID, lines);
  } catch (err) {
    console.error("Telegram notify error:", err);
  }

  return res.status(200).json({ success: true });
}
