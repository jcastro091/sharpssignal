// pages/api/stripe/verify-success.js
import Stripe from "stripe";
import {
  createSupabaseServiceClient,
  hasSupabaseServiceConfig,
} from "../../../lib/supabaseServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function persistVerifiedCheckout(session) {
  if (!hasSupabaseServiceConfig()) return;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      email: session.customer_details?.email || session.customer_email || null,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id:
        typeof session.subscription === "string" ? session.subscription : null,
      stripe_checkout_session_id: session.id,
      plan: session.metadata?.plan || null,
      status: session.status || session.payment_status || "complete",
      entitlement_active: true,
      raw: { session },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" }
  );
  if (error) throw error;
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
      telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_PRO_URL,
    });
  } catch (e) {
    console.error("[verify-success]", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
