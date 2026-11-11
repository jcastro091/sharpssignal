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
  if (!checkout && existing && !existing.user_id && !existing.plan &&
      !metadataUser && !subscription.metadata?.plan && existing.stripe_checkout_session_id) {
    // Legacy paid subscriptions predate account-bound checkout. Persist for review;
    // never manufacture a user binding or repeatedly retry an unresolvable mapping.
    requireCondition(existing.stripe_customer_id===customerId,'legacy_customer_mismatch');
    const original=await stripe.checkout.sessions.retrieve(existing.stripe_checkout_session_id);
    requireCondition(original.livemode===true && original.mode==='subscription' &&
      original.status==='complete' && original.payment_status==='paid' &&
      idOf(original.subscription)===subscriptionId && idOf(original.customer)===customerId &&
      !original.metadata?.user_id && !original.client_reference_id,'legacy_checkout_mismatch');
    await store.recordUnmapped({event_id:event.id,payload_hash:digest,event_created:event.created,
      event_type:event.type,stripe_subscription_id:subscriptionId,stripe_customer_id:customerId,
      reason:'legacy_subscription_missing_account_binding'});
    return {outcome:'review_required',reason:'legacy_subscription_missing_account_binding'};
  }

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
  // Basil moved service periods to subscription items. Invoice.period_end is
  // the previous usage period, not the end of the purchased service period.
  // Without a price-to-entitlement mapping, mixed periods are ambiguous.
  const items = subscription.items;
  const periods = items?.data;
  const verifiedPeriods =
    items?.has_more === false &&
    Array.isArray(periods) &&
    periods.length > 0 &&
    periods.every(
      (item) =>
        item.subscription === subscriptionId &&
        Number.isSafeInteger(item.current_period_end) &&
        item.current_period_end > 0 &&
        item.current_period_end <= 8640000000000 &&
        item.current_period_end === periods[0].current_period_end,
    );
  // Missing/ambiguous periods must not block revocation of inactive access.
  requireCondition(!active || verifiedPeriods, "subscription_period_unverified");
  const periodEnd = verifiedPeriods ? periods[0].current_period_end : null;
  return store.apply({
    event_id: event.id,
    payload_hash: digest,
    event_created: event.created,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    user_id: userId,
    stripe_checkout_session_id: checkout ? object.id : existing?.stripe_checkout_session_id || null,
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
    } catch (error) {
      const safeReasons=new Set(['invalid_verified_binding','account_mapping_conflict','existing_mapping_required',
        'legacy_customer_mismatch','legacy_checkout_mismatch','review_receipt_conflict','missing_subscription',
        'plan_mismatch','customer_mismatch','event_account_mismatch','unknown_account','replay_conflict',
        'latest_invoice_unpaid_or_missing','subscription_period_unverified']);
      console.error('stripe_webhook_processing_failed',JSON.stringify({event_id:event.id,type:event.type,
        reason:safeReasons.has(error?.message)?error.message:'provider_or_storage_failure',
        code:/^[A-Z0-9_]{1,30}$/.test(error?.code||'')?error.code:null}));
      // Retry on provider/schema/mapping failures; never acknowledge a lost entitlement update.
      return res
        .status(503)
        .json({ received: false, error: "entitlement_not_applied" });
    }
  };
}
