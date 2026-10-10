// Local-only sandbox harness. Never load production .env files or send Telegram messages.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module"),
  ts = require("typescript"),
  Stripe = require("stripe");
const {
  inspectSubscriptionPayment,
} = require("../lib/stripeSubscriptionEvidence.cjs");
const {
  verifiedSubscriptionGrant,
  paidInvite,
} = require("../lib/realtimeBilling.cjs");
const { productChat } = require("../lib/productAccess.cjs");
const stateDir = process.env.SANDBOX_STATE_DIR;
if (!stateDir) throw Error("SANDBOX_STATE_DIR required");
const log = fs.readFileSync(path.join(stateDir, "provision.log"), "utf8");
const credentials = JSON.parse(
  log.slice(log.indexOf("{"), log.lastIndexOf("}") + 1),
);
if (!/^(?:sk|rk|rkcs)_test_/.test(credentials.secret_key))
  throw Error("test_key_required");
const stripe = new Stripe(credentials.secret_key, {
  apiVersion: "2025-06-30.basil",
  timeout: 20000,
  maxNetworkRetries: 1,
});
const host = "127.0.0.1:3211",
  origin = "http://" + host,
  receipts = [];
const env = {
  PRO_CHAT_ID: "-1002756836961",
  MARKET_SHADOW_TELEGRAM_CHAT_ID: "-1002635869925",
  OPS_TELEGRAM_CHAT_ID: "-1002794017379",
  BUSINESS_TELEGRAM_CHAT_ID: "-1003503621866",
};
const users = {
  sports: "00000000-0000-0000-0000-000000000101",
  markets: "00000000-0000-0000-0000-000000000102",
  both: "00000000-0000-0000-0000-000000000103",
};
let db, priceId;
function response() {
  return {
    code: 200,
    setHeader() {},
    status(n) {
      this.code = n;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
}
async function createCheckout(scenario) {
  const selected = scenario === "both" ? ["sports", "markets"] : [scenario];
  if (!users[scenario]) throw Error("invalid_scenario");
  let checkout;
  const realStripe = Object.create(stripe);
  realStripe.checkout = {
    sessions: {
      create: async (args) => {
        checkout = await stripe.checkout.sessions.create(args);
        assert.equal(checkout.livemode, false);
        return checkout;
      },
    },
  };
  const ctx = {
    user: {
      id: users[scenario],
      email: "e2e-" + scenario + "@example.invalid",
      user_metadata: { interests: selected },
    },
    stripe: realStripe,
    supabase: {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is: async () => ({ data: [] }),
        };
      },
    },
  };
  const file = path.resolve("pages/api/stripe/create-checkout-session.js"),
    real = createRequire(file),
    exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    process: { env: { PAID_CHECKOUT_ENABLED: "true" } },
    URL,
    require: (n) =>
      n.endsWith("/billingServer")
        ? { billingUser: async () => ctx }
        : n.includes("checkoutOffer.cjs")
          ? {
              checkoutOrigin: () => origin,
              checkoutOffer: async () => {
                const p = await stripe.prices.retrieve(priceId);
                assert.equal(p.livemode, false);
                assert.equal(p.unit_amount, 2000);
                return { price_id: p.id };
              },
            }
          : real(n),
  });
  const res = response();
  await exports.default(
    { method: "POST", headers: { origin, host }, body: { products: selected } },
    res,
  );
  // The production API must refuse the test-mode session, even in this isolated harness.
  assert.equal(res.code, 503);
  assert.equal(checkout?.livemode, false);
  fs.writeFileSync(
    path.join(stateDir, scenario + "-session.json"),
    JSON.stringify(
      {
        id: checkout.id,
        url: checkout.url,
        products: selected,
        user_id: users[scenario],
      },
      null,
      2,
    ),
  );
  return checkout.url;
}
async function verify(sessionId) {
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  assert.equal(s.livemode, false);
  const row = await inspectSubscriptionPayment(
    stripe,
    sessionId,
    s.metadata.user_id,
    Date.now(),
    { livemode: false, priceId },
  );
  assert.equal(row.billing_mode, "test");
  assert.equal(row.amount_cents, 2000 * row.products.length);
  await assert.rejects(
    () =>
      verifiedSubscriptionGrant(
        stripe,
        { rpc: () => assert.fail("production persistence must not run") },
        sessionId,
        row.user_id,
      ),
    /invalid_checkout_id/,
  );
  await assert.rejects(
    () =>
      paidInvite({
        grant: row,
        send: () => assert.fail("test receipt must never reach Telegram"),
      }),
    /payment_required/,
  );
  const applied = await db.query(
    "select apply_customer_payment($1::jsonb) as grant",
    [JSON.stringify(row)],
  );
  assert.deepEqual(
    [...applied.rows[0].grant.products].sort(),
    [...row.products].sort(),
  );
  const receipt = {
    scenario: row.products.join("+"),
    session_id: sessionId,
    subscription_id: row.stripe_subscription_id,
    amount_cents: row.amount_cents,
    currency: row.currency,
    billing_mode: row.billing_mode,
    products: row.products,
    expected_destinations: row.products.map((p) => productChat(p, env)),
    sandbox_sql_persisted: true,
    production_test_payment_rejected: true,
    production_telegram_admission_rejected: true,
    telegram_sent: false,
    verified_at: new Date().toISOString(),
  };
  const i = receipts.findIndex((x) => x.session_id === sessionId);
  if (i >= 0) receipts[i] = receipt;
  else receipts.push(receipt);
  fs.writeFileSync(
    path.join(stateDir, "receipts.json"),
    JSON.stringify(receipts, null, 2),
  );
  return receipt;
}
(async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE);
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.role() returns text language sql as $$select current_user::text$$;create table auth.users(id uuid primary key);",
  );
  for (const id of Object.values(users))
    await db.query("insert into auth.users values($1)", [id]);
  // Only the local in-memory SQL accepts test mode. Production migrations are untouched.
  for (const file of [
    "supabase/migrations/202607070003_telegram_account_mapping.sql",
    "schema/customer-realtime-access.sql",
    "supabase/migrations/20261009213303_product_entitlements.sql",
  ])
    await db.exec(
      fs
        .readFileSync(file, "utf8")
        .replaceAll(
          "payment->>'billing_mode' is distinct from 'live'",
          "payment->>'billing_mode' is distinct from 'test'",
        ),
    );
  if (process.argv.includes("--verify-all")) {
    for (const scenario of Object.keys(users)) {
      const saved = JSON.parse(
        fs.readFileSync(
          path.join(stateDir, scenario + "-session.json"),
          "utf8",
        ),
      );
      const session = await stripe.checkout.sessions.retrieve(saved.id);
      priceId = session.metadata.price_id;
      const receipt = await verify(saved.id);
      console.log(
        JSON.stringify({
          scenario,
          amount_cents: receipt.amount_cents,
          products: receipt.products,
          verified: true,
        }),
      );
    }
    if (process.argv.includes("--cleanup")) {
      for (const receipt of receipts) {
        const session = await stripe.checkout.sessions.retrieve(
          receipt.session_id,
        );
        assert.equal(session.livemode, false);
        priceId = session.metadata.price_id;
        if (receipt.scenario === "markets") {
          const sub = await stripe.subscriptions.retrieve(
            receipt.subscription_id,
          );
          const payments = await stripe.invoicePayments.list({
            invoice: sub.latest_invoice,
            status: "paid",
            limit: 2,
          });
          const refund = await stripe.refunds.create({
            payment_intent: payments.data[0].payment.payment_intent,
          });
          assert.equal(refund.status, "succeeded");
          await assert.rejects(
            () =>
              inspectSubscriptionPayment(
                stripe,
                session.id,
                session.metadata.user_id,
                Date.now(),
                { livemode: false, priceId },
              ),
            /subscription_payment_not_verified/,
          );
          receipt.refunded_payment_rejected = true;
        }
        const cancelled = await stripe.subscriptions.cancel(
          receipt.subscription_id,
        );
        assert.equal(cancelled.status, "canceled");
        await assert.rejects(
          () =>
            inspectSubscriptionPayment(
              stripe,
              session.id,
              session.metadata.user_id,
              Date.now(),
              { livemode: false, priceId },
            ),
          /subscription_payment_not_verified/,
        );
        receipt.cancelled_subscription_rejected = true;
        receipt.cleanup_status = "test_subscription_cancelled";
        fs.writeFileSync(
          path.join(stateDir, "receipts.json"),
          JSON.stringify(receipts, null, 2),
        );
        console.log(
          JSON.stringify({
            scenario: receipt.scenario,
            cleanup: receipt.cleanup_status,
            cancelled_subscription_rejected: true,
            refunded_payment_rejected:
              receipt.refunded_payment_rejected || false,
          }),
        );
      }
    }
    await db.close();
    return;
  }
  const p = await stripe.products.create({
    name: "TEST—NO BET/NO TRADE | SharpsSignal subscription E2E",
    metadata: { purpose: "isolated_product_access_e2e" },
  });
  const price = await stripe.prices.create({
    product: p.id,
    currency: "usd",
    unit_amount: 2000,
    recurring: { interval: "month" },
  });
  assert.equal(price.livemode, false);
  priceId = price.id;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === "/start") {
        const dest = await createCheckout(url.searchParams.get("product"));
        res.writeHead(302, { Location: dest });
        res.end();
        return;
      }
      if (url.pathname === "/billing" && url.searchParams.has("session_id")) {
        const receipt = await verify(url.searchParams.get("session_id"));
        res.setHeader("content-type", "text/html");
        res.end(
          "<h1>Stripe sandbox payment verified</h1><p>TEST—NO BET/NO TRADE. No live money or production entitlement.</p><pre>" +
            JSON.stringify(receipt, null, 2) +
            '</pre><a href="/">Next scenario</a>',
        );
        return;
      }
      res.setHeader("content-type", "text/html");
      res.end(
        "<h1>SharpsSignal isolated Stripe sandbox E2E</h1><p>TEST—NO BET/NO TRADE. Uses actual Stripe test payments, local fixture identities and local SQL. No production data or Telegram writes.</p>" +
          ["sports", "markets", "both"]
            .map(
              (p) =>
                '<p><a href="/start?product=' +
                p +
                '">Test ' +
                p +
                " — $" +
                (p === "both" ? 40 : 20) +
                "/month simulated</a></p>",
            )
            .join(""),
      );
    } catch (e) {
      res.statusCode = 500;
      res.end(
        "Sandbox verification failed: " +
          String(e.message).replace(/\b\w+_(?:test|live)_\w+/g, "[REDACTED]"),
      );
      console.error("sandbox_request_failed", e.type || e.code || e.message);
    }
  });
  server.listen(3211, "127.0.0.1", () =>
    console.log(
      JSON.stringify({
        ready: true,
        url: origin,
        sandbox_account: credentials.account_id,
        live_mode: false,
      }),
    ),
  );
})().catch((e) => {
  console.error(
    "sandbox_setup_failed",
    String(e.message).replace(/\b\w+_(?:test|live)_\w+/g, "[REDACTED]"),
  );
  process.exitCode = 1;
});
