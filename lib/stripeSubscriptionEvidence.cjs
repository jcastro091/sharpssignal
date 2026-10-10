const { metadataProducts } = require("./productAccess.cjs");
const idOf = (value) => (typeof value === "string" ? value : value?.id);
function requireTrue(value, error) {
  if (!value) throw Error(error);
}
async function inspectSubscriptionPayment(
  stripe,
  sessionId,
  userId,
  now = Date.now(),
  { livemode = true, priceId = process.env.STRIPE_PRICE_PRO_TELEGRAM } = {},
) {
  requireTrue(typeof livemode === "boolean", "invalid_billing_mode");
  const fail = (condition) =>
    requireTrue(condition, "subscription_payment_not_verified");
  requireTrue(
    (livemode ? /^cs_live_[A-Za-z0-9]+$/ : /^cs_test_[A-Za-z0-9]+$/).test(
      sessionId,
    ),
    "invalid_checkout_id",
  );
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  fail(
    session.livemode === livemode &&
      session.mode === "subscription" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      session.metadata?.user_id === userId &&
      session.metadata?.plan === "pro_telegram",
  );
  const subscription = await stripe.subscriptions.retrieve(
    idOf(session.subscription),
    { expand: ["latest_invoice"] },
  );
  const invoice = subscription.latest_invoice,
    items = subscription.items;
  fail(
    subscription.livemode === livemode &&
      subscription.status === "active" &&
      subscription.metadata?.user_id === userId &&
      subscription.metadata?.plan === "pro_telegram" &&
      idOf(subscription.customer) === idOf(session.customer),
  );
  fail(
    invoice &&
      typeof invoice === "object" &&
      invoice.livemode === livemode &&
      invoice.status === "paid" &&
      invoice.amount_paid > 0 &&
      idOf(invoice.customer) === idOf(session.customer) &&
      idOf(
        invoice.parent?.subscription_details?.subscription ||
          invoice.subscription,
      ) === subscription.id,
  );
  fail(
    items?.has_more === false &&
      items.data?.length === 1 &&
      idOf(items.data[0].subscription) === subscription.id &&
      Number.isSafeInteger(items.data[0].current_period_end) &&
      items.data[0].current_period_end * 1000 > now,
  );
  const selected = metadataProducts(session.metadata);
  fail(
    JSON.stringify(selected) ===
      JSON.stringify(metadataProducts(subscription.metadata)),
  );
  if (session.metadata.products != null) {
    const item = items.data[0];
    fail(
      session.metadata.price_id === priceId &&
        idOf(item.price) === session.metadata.price_id &&
        item.quantity === selected.length,
    );
  }
  const payments = await stripe.invoicePayments.list({
    invoice: invoice.id,
    status: "paid",
    limit: 2,
  });
  fail(payments.has_more === false && payments.data?.length === 1);
  const payment = payments.data[0];
  fail(
    payment.livemode === livemode &&
      payment.status === "paid" &&
      payment.amount_paid === invoice.amount_paid &&
      payment.currency === invoice.currency &&
      idOf(payment.invoice) === invoice.id &&
      payment.payment?.type === "payment_intent",
  );
  const intent = await stripe.paymentIntents.retrieve(
    idOf(payment.payment.payment_intent),
    { expand: ["latest_charge"] },
  );
  const charge = intent.latest_charge;
  fail(
    intent.livemode === livemode &&
      intent.status === "succeeded" &&
      intent.amount_received === invoice.amount_paid &&
      intent.currency === invoice.currency &&
      idOf(intent.customer) === idOf(session.customer),
  );
  fail(
    charge &&
      typeof charge === "object" &&
      charge.livemode === livemode &&
      charge.paid === true &&
      charge.captured === true &&
      charge.amount === invoice.amount_paid &&
      charge.currency === invoice.currency &&
      charge.amount_refunded === 0 &&
      !charge.refunded &&
      !charge.disputed &&
      idOf(charge.customer) === idOf(session.customer) &&
      idOf(charge.payment_intent) === intent.id &&
      Number.isSafeInteger(charge.created) &&
      charge.created * 1000 <= now,
  );
  const row = {
    stripe_session_id: session.id,
    user_id: userId,
    billing_mode: livemode ? "live" : "test",
    plan: "pro_telegram",
    products: selected,
    status: "paid",
    stripe_subscription_id: subscription.id,
    stripe_customer_id: idOf(session.customer),
    paid_at: new Date(charge.created * 1000).toISOString(),
    valid_until: new Date(
      items.data[0].current_period_end * 1000,
    ).toISOString(),
    verified_at: new Date(now).toISOString(),
    qa_test: false,
    amount_cents: invoice.amount_paid,
    currency: invoice.currency,
  };
  return row;
}
module.exports = { inspectSubscriptionPayment };
