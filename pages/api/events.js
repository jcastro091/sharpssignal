import crypto from "crypto";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../../lib/supabaseServer";

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "page_view",
  "picks_preview_view",
  "record_view",
  "weekly_report_view",
  "signup_view",
  "subscribe_view",
  "dashboard_view",
  "plan_view",
  "signup_click",
  "signup_submit",
  "signup_success",
  "lead_created",
  "checkout_click",
  "checkout_success",
  "subscribe_success",
  "telegram_join_click",
  "telegram_join_verified",
  "support_contact",
  "refund_requested",
  "subscription_cancelled",
  "manual_beta_invite",
]);

function cleanText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  if (!hasSupabaseServiceConfig()) return res.status(200).json({ ok: true, persisted: false, reason: "missing_supabase" });

  const body = req.body || {};
  const eventName = cleanText(body.event_name, 80);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({ ok: false, error: "Unsupported event_name" });
  }

  const row = {
    event_id:
      cleanText(body.event_id, 160) ||
      stableId("funnel", eventName, body.visitor_id, body.session_id, body.email, body.page_url, Date.now()),
    event_name: eventName,
    event_type: eventName,
    visitor_id: cleanText(body.visitor_id, 120) || null,
    session_id: cleanText(body.session_id, 120) || null,
    email: cleanText(body.email, 320).toLowerCase() || null,
    source: cleanText(body.source, 40) || "web",
    page_path: cleanText(body.page_path, 500) || null,
    page_url: cleanText(body.page_url, 1000) || null,
    referrer: cleanText(body.referrer, 1000) || null,
    utm_source: cleanText(body.utm_source, 200) || null,
    utm_medium: cleanText(body.utm_medium, 200) || null,
    utm_campaign: cleanText(body.utm_campaign, 200) || null,
    utm_term: cleanText(body.utm_term, 200) || null,
    utm_content: cleanText(body.utm_content, 200) || null,
    referral_code: cleanText(body.referral_code, 200) || null,
    landing_page: cleanText(body.landing_page, 1000) || null,
    partner_id: cleanText(body.partner_id, 200) || cleanText(body.metadata?.partner_id, 200) || null,
    plan: cleanText(body.plan, 120) || cleanText(body.metadata?.plan, 120) || null,
    metadata: {
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      referral_code: cleanText(body.referral_code, 200) || null,
      landing_page: cleanText(body.landing_page, 1000) || null,
      plan: cleanText(body.plan, 120) || cleanText(body.metadata?.plan, 120) || null,
      checkout_url: cleanText(body.checkout_url, 1000) || cleanText(body.metadata?.checkout_url, 1000) || null,
      location: cleanText(body.location, 200) || cleanText(body.metadata?.location, 200) || null,
    },
  };

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await insertWithColumnFallback(supabase, "funnel_events", row);
    if (error) {
      console.warn("[events] Supabase write failed:", error.message);
      return res.status(200).json({ ok: true, persisted: false, reason: error.message });
    }
    return res.status(200).json({ ok: true, persisted: true });
  } catch (error) {
    console.warn("[events]", error?.message || error);
    return res.status(200).json({ ok: true, persisted: false, reason: "write_failed" });
  }
}

async function insertWithColumnFallback(supabase, table, row) {
  let payload = { ...row };
  let result = await supabase.from(table).insert(payload);
  const removed = new Set();
  while (result.error) {
    const column = missingColumn(result.error.message);
    if (!column || removed.has(column) || !(column in payload)) break;
    removed.add(column);
    payload = { ...payload };
    delete payload[column];
    result = await supabase.from(table).insert(payload);
  }
  return result;
}

function missingColumn(message = "") {
  const match = String(message).match(/'([^']+)' column|column '([^']+)'|Could not find the '([^']+)'/i);
  return match?.[1] || match?.[2] || match?.[3] || "";
}

function stableId(...parts) {
  const source = parts.map((part) => cleanText(part, 1000)).join("|");
  return `${cleanText(parts[0], 40) || "id"}_${crypto.createHash("sha256").update(source).digest("hex").slice(0, 20)}`;
}
