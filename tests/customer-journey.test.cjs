const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { checkoutOffer, checkoutOrigin } = require("../lib/checkoutOffer.cjs");
const env = {
  PAID_CHECKOUT_ENABLED: "true",
  STRIPE_PRICE_PRO_TELEGRAM: "price_existing",
  CHECKOUT_ORIGIN: "https://www.sharps-signal.com",
};
const price = () => ({
  id: "price_existing",
  active: true,
  livemode: true,
  type: "recurring",
  product: { active: true },
  unit_amount: 2000,
  currency: "usd",
  recurring: { usage_type: "licensed", interval: "month", interval_count: 1 },
});
test("checkout displays and uses only a valid active live recurring offer", async () => {
  assert.equal(
    (await checkoutOffer({ prices: { retrieve: async () => price() } }, env))
      .amount,
    2000,
  );
  for (const mutate of [
    (p) => (p.active = false),
    (p) => (p.livemode = false),
    (p) => (p.product.active = false),
    (p) => (p.unit_amount = 0),
    (p) => (p.recurring.usage_type = "metered"),
  ]) {
    const p = price();
    mutate(p);
    await assert.rejects(() =>
      checkoutOffer({ prices: { retrieve: async () => p } }, env),
    );
  }
  assert.equal(
    checkoutOrigin({ NEXT_PUBLIC_BASE_URL: "https://www.sharps-signal.com/" }),
    "https://www.sharps-signal.com",
  );
  assert.throws(() =>
    checkoutOrigin({ CHECKOUT_ORIGIN: "https://evil.invalid/path" }),
  );
});
function loadRoute(file, ctx, grant = null, enabled = true) {
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/^import[^\n]+\n/gm, "")
    .replace("export default async function", "module.exports=async function");
  const sandbox = {
    module: { exports: {} },
    billingUser: async () => ctx,
    process: { env: { ...env, PAID_CHECKOUT_ENABLED: String(enabled) } },
    URL,
    require: (name) =>
      name.includes("measurement.cjs")
        ? require("../lib/measurement.cjs")
        : name.includes("checkoutOffer")
          ? {
              checkoutOffer: (s) => checkoutOffer(s, env),
              checkoutOrigin: () => checkoutOrigin(env),
            }
          : name.includes('productAccess') ? require('../lib/productAccess.cjs')
          : { refreshCustomerGrants: async () => grant ? [{plan:'pro_telegram',products:['sports'],...grant}] : [] },
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports;
}
async function invoke(
  handler,
  req = {
    method: "POST",
    headers: {
      origin: "https://www.sharps-signal.com",
      host: "www.sharps-signal.com",
    },
    body: { price: "price_attacker", user_id: "foreign" },
  },
) {
  let result = { status: 200 };
  const res = {
    setHeader() {},
    status(n) {
      result.status = n;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  await handler(req, res);
  return result;
}
test("live checkout binds server owner/price and returns to billing, not an unowned client destination", async () => {
  let sent;
  const ctx = {
    user: { id: "owner", email: "owner@example.invalid" },
    supabase: {},
    stripe: {
      prices: { retrieve: async () => price() },
      checkout: {
        sessions: {
          create: async (s) => {
            sent = s;
            return {
              livemode: true,
              url: "https://checkout.stripe.com/c/pay/example",
            };
          },
        },
      },
    },
  };
  const handler = loadRoute("pages/api/stripe/create-checkout-session.js", ctx);
  assert.equal((await invoke(handler)).status, 200);
  assert.equal(sent.metadata.user_id, "owner");
  assert.equal(sent.line_items[0].price, "price_existing");
  assert.equal(sent.mode, "subscription");
  assert.match(sent.success_url, /\/billing\?session_id=/);
  assert.match(sent.cancel_url, /checkout=cancelled/);
  sent = null;
  assert.equal(
    (
      await invoke(
        loadRoute("pages/api/stripe/create-checkout-session.js", ctx, {
          qa_test: false,
        }),
      )
    ).status,
    409,
  );
  assert.equal(sent, null);
  assert.equal(
    (
      await invoke(handler, {
        method: "POST",
        headers: {
          origin: "https://foreign.invalid",
          host: "www.sharps-signal.com",
        },
      })
    ).status,
    403,
  );
  assert.equal(sent, null);
  assert.equal(
    (
      await invoke(
        loadRoute(
          "pages/api/stripe/create-checkout-session.js",
          ctx,
          null,
          false,
        ),
      )
    ).status,
    403,
  );
  assert.equal(sent, null);
});
test("billing status separates unpaid, QA and paid access and scopes Telegram linkage to the signed-in owner", async () => {
  let owner;
  const ctx = {
    user: { id: "owner" },
    stripe: {},
    supabase: {
      from: () => ({
        select() {
          return this;
        },
        eq(k, v) {
          owner = v;
          return this;
        },
        maybeSingle: async () => ({ data: { telegram_user_id: "123" } }),
      }),
    },
  };
  for (const [grant, paid] of [
    [null, false],
    [{ qa_test: true }, false],
    [{ qa_test: false }, true],
  ]) {
    const result = await invoke(
      loadRoute("pages/api/billing-status.js", ctx, grant),
      { method: "GET" },
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.paid, paid);
    assert.equal(result.body.telegram_linked, true);
    assert.equal(owner, "owner");
  }
});
