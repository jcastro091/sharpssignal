import crypto from "crypto";
import { buffer } from "micro";
import Stripe from "stripe";
import { createSupabaseServiceClient } from "../../../lib/supabaseServer";
import { createStripeWebhook } from "../../../lib/stripeWebhook";
export const config = { api: { bodyParser: false } };

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function getStore() {
  const db = createSupabaseServiceClient();
  async function one(table, column, value) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return {
    event: (id) => one("stripe_webhook_events", "event_id", id),
    subscription: (id) => one("subscriptions", "stripe_subscription_id", id),
    async user(id) {
      const { data, error } = await db.auth.admin.getUserById(id);
      if (error) throw error;
      return data?.user;
    },
    async apply(payload) {
      const { data, error } = await db.rpc("apply_verified_stripe_event", {
        payload,
      });
      if (error) throw error;
      return data;
    },
  };
}
export default createStripeWebhook({
  readBody: buffer,
  getStripe: () =>
    process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY, {
          timeout: 10000,
          maxNetworkRetries: 0,
        })
      : null,
  getSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
  getStore,
  hashEvent: (event) =>
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify(
          canonical({
            id: event.id,
            type: event.type,
            created: event.created,
            account: event.account || null,
            livemode: event.livemode,
            object: event.data?.object,
          }),
        ),
      )
      .digest("hex"),
});
