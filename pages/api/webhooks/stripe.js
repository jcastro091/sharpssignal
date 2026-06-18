// pages/api/webhooks/stripe.js
import { buffer } from "micro";
import Stripe from "stripe";
import {
  createSupabaseServiceClient,
  hasSupabaseServiceConfig,
} from "../../../lib/supabaseServer";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  const { error } = await supabase.from("subscriptions").upsert(
    {
      email,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id:
        typeof session.subscription === "string" ? session.subscription : null,
      stripe_checkout_session_id: session.id,
      plan: session.metadata?.plan || subscription?.metadata?.plan || null,
      status,
      entitlement_active: entitlementActive(status) || session.payment_status === "paid",
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
      raw: { session, subscription },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (error) throw error;

  const eventWrite = await supabase.from("funnel_events").insert({
    event_name: "subscribe_success",
    email,
    source: "stripe_webhook",
    metadata: {
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
      payment_status: session.payment_status,
      status,
      plan: session.metadata?.plan || subscription?.metadata?.plan || null,
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
  const { error } = await supabase.from("subscriptions").upsert(
    {
      email,
      stripe_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : null,
      stripe_subscription_id: subscription.id,
      plan: subscription.metadata?.plan || null,
      status: subscription.status || "unknown",
      entitlement_active: entitlementActive(subscription.status),
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      raw: { subscription },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (error) throw error;

  if (subscription.cancel_at_period_end || subscription.status === "canceled" || subscription.status === "unpaid") {
    const eventWrite = await supabase.from("funnel_events").insert({
      event_name: "subscription_cancelled",
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
