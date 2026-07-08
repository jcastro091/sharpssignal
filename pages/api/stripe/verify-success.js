// pages/api/stripe/verify-success.js
import Stripe from "stripe";
import {
  createSupabaseServiceClient,
  hasSupabaseServiceConfig,
} from "../../../lib/supabaseServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DEFAULT_PLAN = "pro_telegram";

function getTelegramInviteUrl() {
  return process.env.TELEGRAM_PRO_URL || null;
}

async function persistVerifiedCheckout(session) {
  if (!hasSupabaseServiceConfig()) return;

  const supabase = createSupabaseServiceClient();
  const email = session.customer_details?.email || session.customer_email || null;
  const attribution = attributionFromSession(session);
  const plan = session.metadata?.plan || DEFAULT_PLAN;
  const { error } = await upsertWithColumnFallback(
    supabase,
    "subscriptions",
    {
      subscription_id:
        (typeof session.subscription === "string" && session.subscription) ||
        session.id,
      email,
      customer_email: email,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id:
        typeof session.subscription === "string" ? session.subscription : null,
      stripe_checkout_session_id: session.id,
      plan,
      status: session.status || session.payment_status || "complete",
      entitlement_active: true,
      utm_source: attribution.utm_source || null,
      utm_medium: attribution.utm_medium || null,
      utm_campaign: attribution.utm_campaign || null,
      utm_term: attribution.utm_term || null,
      utm_content: attribution.utm_content || null,
      referral_code: attribution.referral_code || null,
      partner_id: attribution.partner_id || null,
      landing_page: attribution.landing_page || null,
      referrer: attribution.referrer || null,
      raw: { session, attribution },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (error) throw error;

  const eventWrite = await insertWithColumnFallback(supabase, "funnel_events", {
    event_id: stableEventId("subscribe_success", session.id),
    event_name: "subscribe_success",
    event_type: "subscribe_success",
    email,
    source: "stripe_verify_success",
    plan,
    page_path: attribution.first_path || null,
    page_url: attribution.landing_page || null,
    referrer: attribution.referrer || null,
    utm_source: attribution.utm_source || null,
    utm_medium: attribution.utm_medium || null,
    utm_campaign: attribution.utm_campaign || null,
    utm_term: attribution.utm_term || null,
    utm_content: attribution.utm_content || null,
    referral_code: attribution.referral_code || null,
    landing_page: attribution.landing_page || null,
    partner_id: attribution.partner_id || null,
    metadata: {
      ...attribution,
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
      payment_status: session.payment_status,
      status: session.status,
      plan,
    },
  });
  if (eventWrite.error) console.warn("[verify-success] funnel event write failed:", eventWrite.error.message);
}

function attributionFromSession(session) {
  const metadata = session?.metadata || {};
  return {
    utm_source: metadata.utm_source || "",
    utm_medium: metadata.utm_medium || "",
    utm_campaign: metadata.utm_campaign || "",
    utm_term: metadata.utm_term || "",
    utm_content: metadata.utm_content || "",
    referral_code: metadata.referral_code || metadata.ref || "",
    partner_id: metadata.partner_id || "",
    referrer: metadata.referrer || "",
    landing_page: metadata.landing_page || "",
    first_path: metadata.first_path || "",
    client_reference_id: session?.client_reference_id || "",
  };
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

async function upsertWithColumnFallback(supabase, table, row, options) {
  let payload = { ...row };
  let result = await supabase.from(table).upsert(payload, options);
  const removed = new Set();
  while (result.error) {
    const column = missingColumn(result.error.message);
    if (!column || removed.has(column) || !(column in payload)) break;
    removed.add(column);
    payload = { ...payload };
    delete payload[column];
    result = await supabase.from(table).upsert(payload, options);
  }
  return result;
}

function missingColumn(message = "") {
  const match = String(message).match(/'([^']+)' column|column '([^']+)'|Could not find the '([^']+)'/i);
  return match?.[1] || match?.[2] || match?.[3] || "";
}

function stableEventId(...parts) {
  return ["stripe", ...parts].filter(Boolean).join(":").slice(0, 180);
}

export default async function handler(req, res) {
  try {
    const session_id = req.query.session_id;
    if (!session_id) return res.status(400).json({ ok: false, error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paid = session.payment_status === "paid" || session.status === "complete";
    if (!paid) return res.status(403).json({ ok: false, error: "Not paid" });

    try {
      await persistVerifiedCheckout(session);
    } catch (err) {
      console.warn("[verify-success] Supabase entitlement write failed:", err?.message || err);
    }

    return res.status(200).json({
      ok: true,
      telegramUrl: getTelegramInviteUrl(),
    });
  } catch (e) {
    console.error("[verify-success]", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
