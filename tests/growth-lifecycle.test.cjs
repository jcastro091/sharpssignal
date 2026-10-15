const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  summarizeLifecycle,
  signupWeek,
} = require("../lib/growthLifecycle.cjs");
const { cleanEvent } = require("../lib/measurement.cjs");
const {
  issueRecordProof,
  verifyRecordProof,
} = require("../lib/recordViewProof.cjs");
const day = 86400000,
  now = Date.parse("2026-11-20T12:00:00Z"),
  created = now - 40 * day;
const iso = (t) => new Date(t).toISOString();
const acquisition = {
  version: "2026-10-15-v2",
  visitor_id: "v_browser_1234567890",
  utm_source: "x",
  utm_medium: "social",
  utm_campaign: "free",
  utm_content: "post_1",
};
const account = (id = "account-1", overrides = {}) => ({
  id,
  created_at: iso(created),
  email_confirmed_at: iso(created + 1000),
  acquisition,
  ...overrides,
});
const event = (event_name, time, extra = {}) => ({
  event_name,
  source: "web",
  visitor_id: acquisition.visitor_id,
  created_at: iso(time),
  metadata: {},
  ...extra,
});
const action = (time, key = "a", extra = {}) =>
  event("record_view", time, {
    user_id: "account-1",
    metadata: { authenticated_record: "v1", record_key: key.repeat(64) },
    ...extra,
  });
const statuses = {
  accounts: "available",
  waitlist: "available",
  payments: "available",
  activity: "available",
};
const report = (events = [], extra = {}, opts = {}) =>
  summarizeLifecycle(
    events,
    { accounts: [account()], statuses, ...extra },
    { now, since: iso(now - 90 * day), ...opts },
  );
test("browser success and forged identity cannot create verified accounts or activation", () => {
  const d = report(
    [
      event("signup_success", created),
      action(created + day, "a", { metadata: { record_key: "a".repeat(64) } }),
    ],
    { accounts: [] },
  );
  assert.equal(d.conversions.created, 0);
  assert.equal(d.conversions.activated, 0);
  const clean = cleanEvent({
    event_name: "record_view",
    user_id: "victim",
    metadata: {
      authenticated_record: "v1",
      record_key: "a".repeat(64),
      record_proof: "private",
    },
  });
  assert.equal(clean.user_id, undefined);
  assert.equal(clean.metadata.authenticated_record, undefined);
  assert.equal(clean.metadata.record_proof, undefined);
  for (const event_name of [
    "account_created",
    "email_confirmed",
    "paid_checkout_verified",
  ])
    assert.equal(cleanEvent({ event_name }), null);
});
test("verified accounts count independently of page/click order; pending confirmation is separate", () => {
  const d = report([event("signup_submit", created - 1000)], {
    accounts: [
      account(),
      account(),
      account("pending", { email_confirmed_at: null }),
    ],
  });
  assert.deepEqual(d.conversions, {
    submitted: 1,
    created: 2,
    confirmed: 1,
    activated: 0,
    returning: 0,
    attributed: 2,
  });
});
test("cross-device record views activate the verified account and original post attribution", () => {
  const d = report([
    action(created + day, "a", { visitor_id: "different-device" }),
  ]);
  assert.equal(d.conversions.activated, 1);
  assert.equal(d.campaigns[0].content, "post_1");
  assert.equal(d.campaigns[0].activated, 1);
  assert.ok(!JSON.stringify(d).includes("account-1"));
  assert.ok(!JSON.stringify(d).includes(acquisition.visitor_id));
});
test("retention excludes repeated same record, same-day actions and immature cohorts", () => {
  let d = report([
    action(created + 10000),
    action(created + day * 2),
    action(created + 20000, "b"),
  ]);
  assert.equal(d.cohorts[0].d7.returned, 0);
  d = report([
    action(created + 10000),
    action(created + 2 * day, "b"),
    action(created + 2 * day, "b"),
  ]);
  assert.deepEqual(d.cohorts[0].d7, { eligible: 1, returned: 1, pending: 0 });
  assert.deepEqual(d.cohorts[0].d30, { eligible: 1, returned: 1, pending: 0 });
  d = report([], {
    accounts: [
      account("young", {
        created_at: iso(now - 3 * day),
        email_confirmed_at: iso(now - 3 * day + 1000),
      }),
    ],
  });
  assert.deepEqual(d.cohorts[0].d7, { eligible: 0, returned: 0, pending: 1 });
});
test("7/30 return windows use signup time and exclude pre-confirmation and pre-signup activity", () => {
  const d = report([
    action(created - 1000),
    action(created + 100),
    action(created + 2 * day),
    action(created + 10 * day, "b"),
    action(created + 35 * day, "c"),
  ]);
  assert.equal(d.cohorts[0].d7.returned, 0);
  assert.equal(d.cohorts[0].d30.returned, 1);
});
test("unlinked history is not retrospectively assigned a campaign or retention denominator", () => {
  const d = report([], {
    accounts: [account("legacy", { acquisition: null })],
  });
  assert.equal(d.campaigns[0].source, "unattributed");
  assert.equal(d.cohorts[0].measurable, 0);
  assert.equal(d.cohorts[0].d7.eligible, 0);
});
test("missing and partial sources stay unknown rather than zero", () => {
  const d = report([], {
    statuses: {
      accounts: "unavailable",
      waitlist: "partial",
      payments: "unavailable",
      activity: "partial",
    },
  });
  assert.equal(d.conversions.created, null);
  assert.equal(d.conversions.submitted, null);
  assert.equal(d.conversions.activated, null);
  assert.equal(d.cohorts, null);
  assert.equal(
    d.offers.find((x) => x.key === "pick_interest").steps.at(-1).value,
    null,
  );
  assert.equal(
    d.offers.find((x) => x.key === "subscription").steps.at(-1).value,
    null,
  );
});
test("post/email tags stay separate and all offer funnels use their own evidence", () => {
  const paid = {
    id: "sub",
    created: now / 1000,
    mode: "subscription",
    livemode: true,
    status: "complete",
    payment_status: "paid",
    amount_total: 500,
    metadata: { plan: "pro_telegram" },
  };
  const pick = {
    ...paid,
    id: "pick",
    mode: "payment",
    metadata: { product_type: "pick" },
  };
  const d = report(
    [
      event("page_view", created, { ...acquisition }),
      event("page_view", created + day, {
        ...acquisition,
        visitor_id: "v_other",
        utm_content: "post_2",
      }),
      event("pick_waitlist_submit", created),
      event("pick_checkout_click", created),
    ],
    {
      payments: [
        paid,
        paid,
        pick,
        {
          ...pick,
          id: "qa",
          metadata: { product_type: "pick", owner_verification: "true" },
        },
        { ...paid, id: "test", livemode: false },
        { ...paid, id: "unpaid", payment_status: "unpaid" },
      ],
      waitlist: [{ created_at: iso(created), ...acquisition }],
    },
  );
  assert.equal(d.campaigns.length, 2);
  assert.equal(d.campaigns.find((x) => x.content === "post_1").confirmed, 1);
  assert.equal(d.campaigns.find((x) => x.content === "post_2").confirmed, 0);
  assert.equal(
    d.offers.find((x) => x.key === "subscription").steps.at(-1).value,
    1,
  );
  assert.equal(
    d.offers.find((x) => x.key === "pick_purchase").steps.at(-1).value,
    1,
  );
  assert.equal(
    d.offers.find((x) => x.key === "pick_interest").steps.at(-1).value,
    1,
  );
  assert.equal(
    d.offers.find((x) => x.key === "free_play_email").status,
    "not_configured",
  );
});
test("server receipts are user-bound, expire, reject tampering and keep raw record details out", () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
  const proof = issueRecordProof(
    "account-1",
    "sports",
    { entry_id: "sensitive-record", cohort: "research" },
    now,
  );
  assert.equal(verifyRecordProof(proof, "account-1", now).section, "sports");
  assert.equal(verifyRecordProof(proof, "another-user", now), null);
  assert.equal(verifyRecordProof(proof, "account-1", now + 31 * 60000), null);
  assert.equal(verifyRecordProof(proof + "x", "account-1", now), null);
  assert.ok(
    !Buffer.from(proof.split(".")[0], "base64url")
      .toString()
      .includes("sensitive-record"),
  );
  assert.throws(
    () => issueRecordProof("account-1", "sports", {}, now),
    /identity/,
  );
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
test("signup-week boundaries use Monday in New York across daylight savings", () => {
  assert.equal(signupWeek("2026-10-19T02:00:00Z"), "2026-10-12");
  assert.equal(signupWeek("2026-11-02T04:30:00Z"), "2026-10-26");
  assert.equal(signupWeek("2026-11-02T05:00:00Z"), "2026-11-02");
});
