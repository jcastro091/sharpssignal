import Stripe from "stripe";
import { getCeoAccess } from "../../lib/ceoAccess";
import { createSupabaseServiceClient } from "../../lib/supabaseServer";
const { summarize } = require("../../lib/growthReport.cjs");
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const access = await getCeoAccess(req, res);
  if (!access.allowed) return res.status(403).json({ ok: false });
  const days = [7, 30, 90].includes(Number(req.query.days))
    ? Number(req.query.days)
    : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const db = createSupabaseServiceClient();
    const events = [];
    let truncated = false;
    for (let offset = 0; offset < 20000; offset += 500) {
      const r = await db
        .from("funnel_events")
        .select(
          "event_id,event_name,event_type,event_at,created_at,visitor_id,session_id,source,page_path,utm_source,utm_campaign,metadata",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .order("event_id", { ascending: true })
        .range(offset, offset + 499)
        .abortSignal(AbortSignal.timeout(12000));
      if (r.error) throw Error();
      events.push(...r.data);
      if (r.data.length < 500) break;
      if (offset === 19500) truncated = true;
    }
    const payments = [];
    let payments_available = Boolean(process.env.STRIPE_SECRET_KEY),
      payments_truncated = false;
    if (payments_available) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2025-06-30.basil",
          timeout: 8000,
          maxNetworkRetries: 0,
        });
        let cursor;
        for (let i = 0; i < 10; i++) {
          const batch = await stripe.checkout.sessions.list({
            limit: 100,
            created: { gte: Math.floor(Date.parse(since) / 1000) },
            ...(cursor ? { starting_after: cursor } : {}),
          });
          payments.push(...batch.data);
          if (!batch.has_more) break;
          cursor = batch.data.at(-1).id;
          if (i === 9) payments_truncated = true;
        }
      } catch {
        payments_available = false;
      }
    }
    return res.json({
      ok: true,
      ...summarize(events, payments, {
        days,
        since,
        truncated,
        payments_available,
        payments_truncated,
      }),
    });
  } catch {
    return res.status(503).json({
      ok: false,
      error: "Analytics could not be loaded. Counts are unavailable, not zero.",
    });
  }
}
