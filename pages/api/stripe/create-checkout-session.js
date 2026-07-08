// pages/api/stripe/create-checkout-session.js
import Stripe from "stripe";

const DEFAULT_PLAN = "pro_telegram";
const DEFAULT_NEXT = "/picks";
const FALLBACK_CHECKOUT_URL =
  process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER ||
  process.env.CHECKOUT_URL_STARTER ||
  "/subscribe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function checkoutPriceId(plan) {
  const normalized = clean(plan || DEFAULT_PLAN).toLowerCase();
  if (normalized === "pro_telegram") {
    return (
      process.env.STRIPE_PRICE_PRO_TELEGRAM ||
      process.env.STRIPE_PRO_TELEGRAM_PRICE_ID ||
      process.env.STRIPE_PRICE_ID ||
      ""
    );
  }
  return process.env.STRIPE_PRICE_ID || "";
}

function siteOrigin(req) {
  const proto = first(req.headers["x-forwarded-proto"]) || "https";
  const host = first(req.headers["x-forwarded-host"]) || req.headers.host || "www.sharps-signal.com";
  return `${proto}://${host}`;
}

function safePath(value, fallback = DEFAULT_NEXT) {
  const path = clean(value, 300) || fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

function attribution(body) {
  return {
    utm_source: clean(body.utm_source, 200),
    utm_medium: clean(body.utm_medium, 200),
    utm_campaign: clean(body.utm_campaign, 200),
    utm_term: clean(body.utm_term, 200),
    utm_content: clean(body.utm_content, 200),
    referral_code: clean(body.referral_code || body.ref, 200),
    partner_id: clean(body.partner_id, 200),
    referrer: clean(body.referrer, 500),
    landing_page: clean(body.landing_page || body.first_url, 500),
    first_path: clean(body.first_path, 300),
    visitor_id: clean(body.visitor_id, 200),
    session_id: clean(body.session_id, 200),
    location: clean(body.location, 200),
  };
}

function compactMetadata(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const cleaned = clean(value);
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

function fallbackUrl(req, body) {
  const origin = siteOrigin(req);
  const url = new URL(FALLBACK_CHECKOUT_URL, origin);
  const fields = {
    plan: body.plan || DEFAULT_PLAN,
    prefilled_email: body.email,
    next: body.next || DEFAULT_NEXT,
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_term: body.utm_term,
    utm_content: body.utm_content,
    referral_code: body.referral_code,
    ref: body.referral_code || body.ref,
    landing_page: body.landing_page || body.first_url,
    first_path: body.first_path,
    referrer: body.referrer,
  };
  for (const [key, value] of Object.entries(fields)) {
    const cleaned = clean(value);
    if (cleaned && !url.searchParams.get(key)) url.searchParams.set(key, cleaned);
  }
  return url.toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const body = req.body || {};
    const plan = clean(body.plan, 80) || DEFAULT_PLAN;
    const priceId = checkoutPriceId(plan);
    const fallback_url = fallbackUrl(req, body);

    if (!stripe || !priceId) {
      return res.status(200).json({
        ok: false,
        fallback_url,
        reason: !stripe ? "missing_stripe_secret_key" : "missing_stripe_price_id",
      });
    }

    const origin = siteOrigin(req);
    const next = safePath(body.next);
    const attr = attribution(body);
    const metadata = compactMetadata({
      ...attr,
      email: body.email,
      plan,
      next,
      source: "server_checkout_session",
    });

    const successUrl = new URL(next, origin);
    successUrl.searchParams.set("checkout", "success");
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    const cancelUrl = new URL("/subscribe", origin);
    cancelUrl.searchParams.set("checkout", "cancelled");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: clean(body.email, 320) || undefined,
      client_reference_id: clean(body.client_reference_id || body.email || attr.visitor_id, 200) || undefined,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      allow_promotion_codes: true,
      metadata,
      subscription_data: { metadata },
    });

    return res.status(200).json({ ok: true, url: session.url, id: session.id });
  } catch (error) {
    console.warn("[create-checkout-session]", error?.message || error);
    return res.status(500).json({ ok: false, error: "checkout_session_failed" });
  }
}
