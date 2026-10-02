const supported = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
]);
const idOf = (value) => (typeof value === "string" ? value : value?.id);
function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

// Only call with a signature-verified event. Store.apply must atomically enforce replay/order/mapping checks.
export async function processStripeEvent(event, digest, { stripe, store }) {
  if (!supported.has(event.type)) return { outcome: "ignored" };
  requireCondition(
    typeof event.id === "string" && Number.isSafeInteger(event.created),
    "invalid_event",
  );
  const prior = await store.event(event.id);
  if (prior) {
    requireCondition(prior.payload_hash === digest, "replay_conflict");
    return { outcome: "duplicate" };
  }
  const object = event.data?.object;
  requireCondition(object && typeof object.id === "string", "invalid_object");
  const checkout = event.type === "checkout.session.completed";
  const invoiceEvent = event.type === "invoice.paid";
  const subscriptionId = checkout
    ? idOf(object.subscription)
    : invoiceEvent
      ? idOf(
          object.parent?.subscription_details?.subscription ||
            object.subscription,
        )
      : object.id;
  requireCondition(
    typeof subscriptionId === "string" && subscriptionId.startsWith("sub_"),
    "missing_subscription",
  );
  // Always refresh; a delayed active snapshot must not undo current cancellation.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  requireCondition(subscription.id === subscriptionId, "subscription_mismatch");
  const customerId = idOf(subscription.customer);
  requireCondition(
    customerId && customerId === idOf(object.customer),
    "customer_mismatch",
  );
  const existing = await store.subscription(subscriptionId);
  const metadataUser = subscription.metadata?.user_id;
  const userId = metadataUser || existing?.user_id;
  requireCondition(
    userId &&
      (!existing ||
        (existing.user_id === userId &&
          existing.stripe_customer_id === customerId)),
    "account_mapping_conflict",
  );
  requireCondition(
    !object.metadata?.user_id || object.metadata.user_id === userId,
    "event_account_mismatch",
  );
  const plan = subscription.metadata?.plan || existing?.plan;
  requireCondition(
    plan === "pro_telegram" && (!existing || existing.plan === plan),
    "plan_mismatch",
  );
  const user = await store.user(userId);
  requireCondition(user?.id === userId, "unknown_account");
  if (checkout) {
    requireCondition(
      object.mode === "subscription" &&
        object.status === "complete" &&
        object.payment_status === "paid",
      "checkout_unpaid",
    );
    requireCondition(
      object.metadata?.user_id === userId &&
        metadataUser === userId &&
        object.metadata?.plan === plan,
      "checkout_mapping_missing",
    );
  } else {
    // Renewal/cancellation may use a previously verified DB binding, never an email fallback.
    requireCondition(existing?.user_id === userId, "existing_mapping_required");
  }
  const invoice = subscription.latest_invoice;
  const invoiceSubscription = idOf(
    invoice?.parent?.subscription_details?.subscription ||
      invoice?.subscription,
  );
  const paid =
    invoice &&
    typeof invoice === "object" &&
    invoice.status === "paid" &&
    invoice.paid === true &&
    idOf(invoice.customer) === customerId &&
    invoiceSubscription === subscriptionId;
  const active = subscription.status === "active" && (checkout || paid);
  if (checkout) requireCondition(active, "subscription_not_active");
  if (event.type === "customer.subscription.deleted")
    requireCondition(subscription.status === "canceled", "deletion_conflict");
  // An active subscription whose latest invoice cannot be verified must not gain access
  // or silently revoke an existing paid member while a provider lookup is incomplete.
  if (subscription.status === "active" && !active)
    throw new Error("latest_invoice_unpaid_or_missing");
  const periodEnd = subscription.current_period_end || invoice?.period_end;
  return store.apply({
    event_id: event.id,
    payload_hash: digest,
    event_created: event.created,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    user_id: userId,
    stripe_checkout_session_id: checkout ? object.id : null,
    plan,
    status: subscription.status,
    entitlement_active: active,
    current_period_end: Number.isFinite(periodEnd)
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    email: user.email || null,
  });
}

export function createStripeWebhook({
  readBody,
  getStripe,
  getSecret,
  getStore,
  hashEvent,
}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    let stripe, secret;
    try {
      stripe = getStripe();
      secret = getSecret();
    } catch {
      return res.status(503).json({ error: "webhook_unavailable" });
    }
    if (!stripe || !secret)
      return res.status(503).json({ error: "webhook_unavailable" });
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        await readBody(req),
        req.headers["stripe-signature"],
        secret,
      );
    } catch {
      return res.status(400).json({ error: "invalid_signature" });
    }
    try {
      const result = await processStripeEvent(event, hashEvent(event), {
        stripe,
        store: getStore(),
      });
      return res.status(200).json({ received: true, ...result });
    } catch {
      // Retry on provider/schema/mapping failures; never acknowledge a lost entitlement update.
      return res
        .status(503)
        .json({ received: false, error: "entitlement_not_applied" });
    }
  };
}
