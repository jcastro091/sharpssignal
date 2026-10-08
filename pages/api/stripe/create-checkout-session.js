const { token, safeUrl } = require("../../../lib/measurement.cjs");
import { billingUser } from "../../../lib/billingServer";
const {
  checkoutOffer,
  checkoutOrigin,
} = require("../../../lib/checkoutOffer.cjs");
const { refreshCustomerAccess } = require("../../../lib/realtimeBilling.cjs");
export default async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const ctx = await billingUser(req, res);
  if (!ctx) return;
  if (process.env.PAID_CHECKOUT_ENABLED !== "true")
    return res
      .status(403)
      .json({ ok: false, error: "paid_checkout_not_enabled" });
  try {
    if (
      !req.headers.origin ||
      new URL(req.headers.origin).host !== req.headers.host
    )
      return res.status(403).json({ ok: false, error: "invalid_origin" });
    const existing = await refreshCustomerAccess(
      ctx.stripe,
      ctx.supabase,
      ctx.user.id,
    );
    if (existing && !existing.qa_test)
      return res.status(409).json({ ok: false, error: "already_paid" });
    const offer = await checkoutOffer(ctx.stripe),
      price = offer.price_id,
      origin = checkoutOrigin();
    const metadata = { user_id: ctx.user.id, plan: "pro_telegram" };
    for (const key of [
      "visitor_id",
      "session_id",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
    ]) {
      const value = token(req.body?.[key]);
      if (value) metadata[key] = value;
    }
    const landing = safeUrl(req.body?.first_url);
    if (landing) metadata.landing_page = landing;
    const session = await ctx.stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: ctx.user.email,
      client_reference_id: ctx.user.id,
      line_items: [{ price, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: origin + "/billing?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/billing?checkout=cancelled",
    });
    if (!session.livemode) throw Error();
    return res.json({ ok: true, url: session.url });
  } catch {
    return res.status(503).json({ ok: false, error: "checkout_unavailable" });
  }
}
