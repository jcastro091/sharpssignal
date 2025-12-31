// pages/api/stripe/verify-success.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    const session_id = req.query.session_id;
    if (!session_id) return res.status(400).json({ ok: false, error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete"; // keep both to be safe

    if (!paid) return res.status(403).json({ ok: false, error: "Not paid" });

    // Option A (simple): return a static join link (still “hidden” behind verification)
    return res.status(200).json({
      ok: true,
      telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_PRO_URL, // server-only env var
    });

    // Option B (stronger): set a signed cookie / write entitlement to DB (recommended)
  } catch (e) {
    console.error("[verify-success]", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
