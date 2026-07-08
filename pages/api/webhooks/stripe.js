// pages/api/webhooks/stripe.js
import { buffer } from "micro";
import Stripe from "stripe";
import {
  createSupabaseServiceClient,
  hasSupabaseServiceConfig,
} from "../../../lib/supabaseServer";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DEFAULT_PLAN = "pro_telegram";

function entitlementActive(status) {
  return ["active", "trialing", "complete", "paid"].includes(
    String(status || "").toLowerCase()
  );
}

async function persistCheckoutSession(session) {
  if (!hasSupabaseServiceConfig()) {
    console.warn("[stripe webhook] Supabase not configured; entitlement not persisted");
    return;
  }

  let subscription = null;
  if (session.subscription) {
    try {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    } catch (err) {
      console.warn("[stripe webhook] subscription retrieve failed:", err?.message || err);
    }
  }

  const status = subscription?.status || session.status || session.payment_status || "unknown";
  const currentPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.email ||
    null;

  const supabase = createSupabaseServiceClient();
  const attribution = attributionFromSession(session);
  const plan = session.metadata?.plan || subscription?.metadata?.plan || DEFAULT_PLAN;
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
      status,
      entitlement_active: entitlementActive(status) || session.payment_status === "paid",
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
      utm_source: attribution.utm_source || null,
      utm_medium: attribution.utm_medium || null,
      utm_campaign: attribution.utm_campaign || null,
      utm_term: attribution.utm_term || null,
      utm_content: attribution.utm_content || null,
      referral_code: attribution.referral_code || null,
      partner_id: attribution.partner_id || null,
      landing_page: attribution.landing_page || null,
      referrer: attribution.referrer || null,
      raw: { session, subscription, attribution },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (error) throw error;

  const eventWrite = await insertFunnelEvent(supabase, {
    event_id: stableEventId("subscribe_success", session.id),
    event_name: "subscribe_success",
    event_type: "subscribe_success",
    email,
    source: "stripe_webhook",
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
      status,
      plan,
    },
  });
  if (eventWrite.error) console.warn("[stripe webhook] funnel event write failed:", eventWrite.error.message);
}

async function persistSubscription(subscription) {
  if (!hasSupabaseServiceConfig()) {
    console.warn("[stripe webhook] Supabase not configured; subscription update not persisted");
    return;
  }

  let email = null;
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    email = customer?.email || null;
  } catch {}

  const supabase = createSupabaseServiceClient();
  const metadata = subscription.metadata || {};
  const { error } = await upsertWithColumnFallback(
    supabase,
    "subscriptions",
    {
      subscription_id: subscription.id,
      email,
      customer_email: email,
      stripe_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : null,
      stripe_subscription_id: subscription.id,
      plan: metadata.plan || DEFAULT_PLAN,
      status: subscription.status || "unknown",
      entitlement_active: entitlementActive(subscription.status),
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      utm_source: metadata.utm_source || null,
      utm_medium: metadata.utm_medium || null,
      utm_campaign: metadata.utm_campaign || null,
      utm_term: metadata.utm_term || null,
      utm_content: metadata.utm_content || null,
      referral_code: metadata.referral_code || metadata.ref || null,
      partner_id: metadata.partner_id || null,
      landing_page: metadata.landing_page || null,
      referrer: metadata.referrer || null,
      raw: { subscription },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (error) throw error;

  if (subscription.cancel_at_period_end || subscription.status === "canceled" || subscription.status === "unpaid") {
    const eventWrite = await insertFunnelEvent(supabase, {
      event_id: stableEventId("subscription_cancelled", subscription.id),
      event_name: "subscription_cancelled",
      event_type: "subscription_cancelled",
      email,
      source: "stripe_webhook",
      metadata: {
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      },
    });
    if (eventWrite.error) console.warn("[stripe webhook] cancellation funnel event write failed:", eventWrite.error.message);
  }
}

async function insertFunnelEvent(supabase, row) {
  return insertWithColumnFallback(supabase, "funnel_events", row);
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
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    await persistCheckoutSession(event.data.object);
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await persistSubscription(event.data.object);
  }

  res.status(200).json({ received: true });
}
