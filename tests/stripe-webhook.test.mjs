import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PGlite } = require(
  process.env.PGLITE_MODULE ||
    "/tmp/sharpssignal-sql-test/node_modules/@electric-sql/pglite",
);
const source = await fs.readFile("lib/stripeWebhook.js", "utf8");
const { processStripeEvent, createStripeWebhook } = await import(
  "data:text/javascript," + encodeURIComponent(source)
);
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log("PASS", name);
}
const owner = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${owner}'), ('${other}');
create table public.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),email text,stripe_customer_id text,stripe_subscription_id text unique,stripe_checkout_session_id text unique,plan text,status text not null default 'unknown',entitlement_active boolean not null default false,current_period_end timestamptz,cancel_at_period_end boolean not null default false,raw jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
await db.exec(
  await fs.readFile(
    "supabase/migrations/202610020001_verified_stripe_events.sql",
    "utf8",
  ),
);
let subscription,
  failLookup = false,
  unknownUser = false,
  applyCalls = 0;
const invoice = () => ({
  id: "in_paid",
  status: "paid",
  paid: true,
  customer: "cus_owner",
  subscription: "sub_owner",
  period_end: 2000,
});
const freshSub = () => ({
  id: "sub_owner",
  customer: "cus_owner",
  status: "active",
  metadata: { user_id: owner, plan: "pro_telegram" },
  latest_invoice: invoice(),
  current_period_end: 2000,
  cancel_at_period_end: false,
});
const freshEvent = () => ({
  id: "evt_checkout",
  created: 100,
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_owned",
      subscription: "sub_owner",
      customer: "cus_owner",
      mode: "subscription",
      status: "complete",
      payment_status: "paid",
      metadata: { user_id: owner, plan: "pro_telegram" },
    },
  },
});
const stripe = {
  subscriptions: {
    retrieve: async () => {
      if (failLookup) throw Error("lookup failed");
      return subscription;
    },
  },
};
const store = {
  event: async (id) =>
    (
      await db.query("select * from stripe_webhook_events where event_id=$1", [
        id,
      ])
    ).rows[0],
  subscription: async (id) =>
    (
      await db.query(
        "select * from subscriptions where stripe_subscription_id=$1",
        [id],
      )
    ).rows[0],
  user: async (id) =>
    unknownUser ? null : { id, email: "member@example.invalid" },
  apply: async (payload) => {
    applyCalls++;
    return (
      await db.query(
        "select apply_verified_stripe_event($1::jsonb) as result",
        [JSON.stringify(payload)],
      )
    ).rows[0].result;
  },
};
async function reset() {
  await db.exec("truncate subscriptions,stripe_webhook_events");
  subscription = freshSub();
  failLookup = false;
  unknownUser = false;
  applyCalls = 0;
}
const deliver = (event = freshEvent(), hash = event.id) =>
  processStripeEvent(event, hash, { stripe, store });
const row = async () => (await db.query("select * from subscriptions")).rows[0];
await test("paid account-bound checkout applies once and duplicates do not write", async () => {
  await reset();
  assert.equal((await deliver()).outcome, "applied");
  assert.equal((await row()).user_id, owner);
  assert.equal((await row()).entitlement_active, true);
  assert.equal((await deliver()).outcome, "duplicate");
  assert.equal(applyCalls, 1);
});
for (const [name, change] of [
  ["completed unpaid", (e) => (e.data.object.payment_status = "unpaid")],
  ["open checkout", (e) => (e.data.object.status = "open")],
  ["wrong checkout account", (e) => (e.data.object.metadata.user_id = other)],
  ["missing checkout account", (e) => delete e.data.object.metadata.user_id],
  ["missing subscription account", () => delete subscription.metadata.user_id],
  ["wrong customer", (e) => (e.data.object.customer = "cus_other")],
  ["wrong plan", () => (subscription.metadata.plan = "other")],
  ["trialing checkout", () => (subscription.status = "trialing")],
  ["failed subscription lookup", () => (failLookup = true)],
  ["unknown auth account", () => (unknownUser = true)],
])
  await test(name + " fails without entitlement writes", async () => {
    await reset();
    const e = freshEvent();
    change(e);
    await assert.rejects(deliver(e));
    assert.equal(await row(), undefined);
  });
await test("conflicting event replay is rejected", async () => {
  await reset();
  await deliver();
  await assert.rejects(deliver(freshEvent(), "changed"), /replay_conflict/);
  assert.equal(applyCalls, 1);
});
const update = (
  id = "evt_update",
  created = 101,
  type = "customer.subscription.updated",
) => ({
  id,
  created,
  type,
  data: {
    object: {
      id: "sub_owner",
      customer: "cus_owner",
      metadata: { user_id: owner },
    },
  },
});
await test("valid paid renewal retains original checkout and account binding", async () => {
  await reset();
  await deliver();
  subscription.current_period_end = 3000;
  await deliver(update());
  assert.equal(
    (await row()).current_period_end.toISOString(),
    new Date(3000 * 1000).toISOString(),
  );
  assert.equal((await row()).stripe_checkout_session_id, "cs_owned");
  assert.equal((await row()).entitlement_active, true);
});
await test("existing mapped customer can renew without legacy metadata", async () => {
  await reset();
  await deliver();
  subscription.metadata = {};
  const e = update();
  e.data.object.metadata = {};
  await deliver(e);
  assert.equal((await row()).entitlement_active, true);
});
await test("missing existing mapping rejects subscription-only grants", async () => {
  await reset();
  await assert.rejects(deliver(update()), /existing_mapping_required/);
  assert.equal(await row(), undefined);
});
await test("wrong stored account binding fails without modifying customer", async () => {
  await reset();
  await deliver();
  subscription.metadata.user_id = other;
  await assert.rejects(deliver(update()), /account_mapping_conflict/);
  assert.equal((await row()).user_id, owner);
});
await test("active renewal with unpaid invoice cannot grant or erase valid prior access", async () => {
  await reset();
  await deliver();
  subscription.latest_invoice.paid = false;
  await assert.rejects(deliver(update()), /latest_invoice/);
  assert.equal((await row()).entitlement_active, true);
});
await test("cancel at period end preserves current paid access", async () => {
  await reset();
  await deliver();
  subscription.cancel_at_period_end = true;
  await deliver(update());
  assert.equal((await row()).entitlement_active, true);
  assert.equal((await row()).cancel_at_period_end, true);
});
await test("canceled and past-due subscriptions revoke mapped access", async () => {
  for (const status of ["canceled", "past_due"]) {
    await reset();
    await deliver();
    subscription.status = status;
    await deliver(
      update(
        "evt_end",
        102,
        status === "canceled"
          ? "customer.subscription.deleted"
          : "customer.subscription.updated",
      ),
    );
    assert.equal((await row()).entitlement_active, false);
  }
});
await test("invoice.paid renews using current subscription and invoice relationship", async () => {
  await reset();
  await deliver();
  const e = {
    id: "evt_invoice",
    created: 103,
    type: "invoice.paid",
    data: { object: invoice() },
  };
  await deliver(e);
  assert.equal((await row()).entitlement_active, true);
});
await test("delayed active event cannot resurrect a canceled subscription", async () => {
  await reset();
  await deliver();
  subscription.status = "canceled";
  await deliver(update("evt_cancel", 105, "customer.subscription.deleted"));
  subscription = freshSub();
  assert.equal((await deliver(update("evt_old", 102))).outcome, "stale");
  assert.equal((await row()).entitlement_active, false);
});
await test("same timestamp conflicting transition rejects atomically", async () => {
  await reset();
  await deliver();
  subscription.status = "canceled";
  await assert.rejects(
    deliver(update("evt_conflict", 100, "customer.subscription.deleted")),
    /same_timestamp_conflict/,
  );
  assert.equal((await row()).entitlement_active, true);
  assert.equal(await store.event("evt_conflict"), undefined);
});
await test("transaction rejects account and checkout remapping plus conflicting replay", async () => {
  await reset();
  await deliver();
  const payload = {
    event_id: "evt_sql",
    payload_hash: "h",
    event_created: 110,
    stripe_subscription_id: "sub_owner",
    stripe_customer_id: "cus_owner",
    user_id: other,
    plan: "pro_telegram",
    status: "active",
    entitlement_active: true,
    cancel_at_period_end: false,
  };
  await assert.rejects(store.apply(payload), /mapping_conflict/);
  payload.user_id = owner;
  payload.stripe_checkout_session_id = "cs_other";
  await assert.rejects(store.apply(payload), /mapping_conflict/);
  payload.event_id = "evt_checkout";
  payload.payload_hash = "changed";
  await assert.rejects(store.apply(payload), /replay_conflict/);
});
await test("duplicate atomic calls produce one applied event", async () => {
  await reset();
  const payload = {
    event_id: "evt_sql",
    payload_hash: "h",
    event_created: 110,
    stripe_subscription_id: "sub_owner",
    stripe_customer_id: "cus_owner",
    user_id: owner,
    plan: "pro_telegram",
    status: "active",
    entitlement_active: true,
    cancel_at_period_end: false,
  };
  const results = await Promise.all([
    store.apply(payload),
    store.apply(payload),
  ]);
  assert.deepEqual(results.map((x) => x.outcome).sort(), [
    "applied",
    "duplicate",
  ]);
  assert.equal(
    (await db.query("select count(*)::int as n from stripe_webhook_events"))
      .rows[0].n,
    1,
  );
});
await test("RPC is denied to public application roles", async () => {
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.apply_verified_stripe_event(jsonb)','EXECUTE') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','public.apply_verified_stripe_event(jsonb)','EXECUTE') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
});
async function route({
  method = "POST",
  configured = true,
  valid = true,
  storeFailure = false,
} = {}) {
  let bodyReads = 0,
    storeReads = 0;
  const handler = createStripeWebhook({
    readBody: async () => {
      bodyReads++;
      return "RAW";
    },
    getStripe: () =>
      configured
        ? {
            ...stripe,
            webhooks: {
              constructEvent: (raw, sig, secret) => {
                assert.equal(raw, "RAW");
                assert.equal(sig, "signature");
                assert.equal(secret, "fake");
                if (!valid) throw Error("bad signature");
                return freshEvent();
              },
            },
          }
        : null,
    getSecret: () => (configured ? "fake" : null),
    getStore: () => {
      storeReads++;
      if (storeFailure) throw Error("schema missing");
      return store;
    },
    hashEvent: () => "route-hash",
  });
  let result;
  const res = {
    setHeader() {},
    status(status) {
      result = { status };
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
  await handler({ method, headers: { "stripe-signature": "signature" } }, res);
  return { ...result, bodyReads, storeReads };
}
await test("invalid signature never reaches storage", async () => {
  await reset();
  const r = await route({ valid: false });
  assert.equal(r.status, 400);
  assert.equal(r.storeReads, 0);
});
await test("missing configuration, wrong method and missing migration fail clearly", async () => {
  assert.equal((await route({ configured: false })).status, 503);
  assert.equal((await route({ method: "GET" })).status, 405);
  assert.equal((await route({ storeFailure: true })).status, 503);
});
await test("signed valid delivery acknowledged only after atomic persistence", async () => {
  await reset();
  const r = await route();
  assert.equal(r.status, 200);
  assert.equal(r.body.outcome, "applied");
  assert.equal((await row()).entitlement_active, true);
});
await test("real Stripe signature validates raw bytes and rejects tampering", async () => {
  const Stripe = require("stripe");
  const client = new Stripe("sk_test_local_only");
  const raw = JSON.stringify(freshEvent());
  const signature = client.webhooks.generateTestHeaderString({
    payload: raw,
    secret: "whsec_local_only",
  });
  assert.equal(
    client.webhooks.constructEvent(
      Buffer.from(raw),
      signature,
      "whsec_local_only",
    ).id,
    "evt_checkout",
  );
  assert.throws(() =>
    client.webhooks.constructEvent(
      Buffer.from(raw + " "),
      signature,
      "whsec_local_only",
    ),
  );
});
await db.close();
console.log(`${count} webhook/SQL tests passed`);
