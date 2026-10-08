import { withAuthTimeout } from "./authWait.js";
// No entitlement writes or invitation disclosure: fulfillment remains disabled.
export function createCheckoutVerifier({ getUser, getStripe }) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    try {
      const user = await withAuthTimeout(() => getUser(req, res));
      if (!user)
        return res.status(401).json({ ok: false, error: "sign_in_required" });
      const id = req.query.session_id;
      if (typeof id !== "string" || !/^cs_[A-Za-z0-9_]{1,200}$/.test(id))
        return res.status(400).json({ ok: false, error: "invalid_session" });
      const stripe = getStripe();
      if (!stripe)
        return res
          .status(503)
          .json({ ok: false, error: "verification_unavailable" });
      const session = await withAuthTimeout(() =>
        stripe.checkout.sessions.retrieve(id, { expand: ["subscription"] }),
      );
      // Only immutable, server-bound user identity is accepted. Legacy email-only sessions fail closed.
      if (!session.metadata?.user_id || session.metadata.user_id !== user.id)
        return res
          .status(403)
          .json({ ok: false, error: "checkout_not_eligible" });
      const subscription = session.subscription;
      if (
        session.mode !== "subscription" ||
        session.status !== "complete" ||
        session.payment_status !== "paid" ||
        session.metadata.plan !== "pro_telegram" ||
        !subscription ||
        typeof subscription !== "object" ||
        subscription.status !== "active" ||
        subscription.metadata?.user_id !== user.id
      )
        return res
          .status(403)
          .json({ ok: false, error: "checkout_not_eligible" });
      return res
        .status(200)
        .json({
          ok: true,
          paymentVerified: true,
          fulfillment: "not_activated",
        });
    } catch {
      return res
        .status(503)
        .json({ ok: false, error: "verification_unavailable" });
    }
  };
}
