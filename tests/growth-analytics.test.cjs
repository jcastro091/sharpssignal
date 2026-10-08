const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cleanEvent, safeUrl } = require("../lib/measurement.cjs");
const { summarize, STAGES } = require("../lib/growthReport.cjs");
test("analytics strips personal fields, URL tokens and arbitrary metadata", () => {
  const e = cleanEvent({
    event_name: "page_view",
    email: "private@example.com",
    page_path: "/billing?session_id=secret",
    page_url: "https://www.sharps-signal.com/billing?session_id=secret#token",
    metadata: { password: "secret", target: "signup", x: 14 },
  });
  assert.equal(e.page_path, "/billing");
  assert.equal(e.page_url, "https://www.sharps-signal.com/billing");
  assert.equal(e.email, undefined);
  assert.equal(e.metadata.password, undefined);
  assert.equal(e.metadata.target, "signup");
  assert.equal(safeUrl("javascript:alert(1)"), "");
});
test("public collection rejects payment claims and auth pages", () => {
  assert.equal(cleanEvent({ event_name: "subscribe_success" }), null);
  assert.equal(
    cleanEvent({ event_name: "page_view", page_path: "/auth/callback" }),
    null,
  );
  assert.equal(
    cleanEvent({ event_name: "page_view", page_path: "/analytics" }),
    null,
  );
});
const row = (name, id = "v_12345678900", i = 0, metadata = {}) => ({
  event_name: name,
  source: "web",
  visitor_id: id,
  created_at: new Date(1791500000000 + i * 1000).toISOString(),
  page_path: "/",
  metadata: { revision: "2026-10-08-v1", ...metadata },
});
test("funnel is ordered, deduplicated by visitor and excludes QA", () => {
  const rows = STAGES.map((s, i) => row(s, undefined, i));
  rows.push(
    row("page_view"),
    row("checkout_click", "v_skipped"),
    row("page_view", "v_qa", 0, { test: true }),
  );
  const d = summarize(rows, [], { payments_available: true });
  assert.deepEqual(
    d.funnel.map((x) => x.visitors),
    [1, 1, 1, 1, 1, 1, 0],
  );
});
test("only actual live paid subscription sessions count; missing source remains unknown", () => {
  const good = {
    created: 1791500010,
    livemode: true,
    mode: "subscription",
    status: "complete",
    payment_status: "paid",
    amount_total: 2000,
    metadata: { plan: "pro_telegram", visitor_id: "v_12345678900" },
  };
  const d = summarize(
    STAGES.map((s, i) => row(s, undefined, i)),
    [
      good,
      { ...good, livemode: false },
      { ...good, metadata: { ...good.metadata, qa_test: "true" } },
      { ...good, payment_status: "unpaid" },
    ],
  );
  assert.equal(d.payments.completed_checkouts, 1);
  assert.equal(d.funnel.at(-1).visitors, 1);
  assert.equal(summarize([], [], { payments_available: false }).payments, null);
});
test("article conversion requires signup after reading; heatmap retains only aggregate fields", () => {
  const rows = [
    row("signup_success", "early", 0),
    row("article_view", "early", 1),
    row("article_view", "later", 0),
    row("signup_success", "later", 1),
    row("site_click", "later", 2, { x: 10, y: 20, device: "mobile" }),
  ];
  const d = summarize(rows);
  assert.equal(d.article.readers, 2);
  assert.equal(d.article.subsequent_signups, 1);
  assert.deepEqual(Object.keys(d.heat[0]), ["path", "device", "x", "y"]);
});
test("article evidence has the documented sequence without fabricated price or outcome", () => {
  const d = require("../public/evidence/marlins-diamondbacks-2026-09-15.json");
  assert.equal(d.observations.length, 7);
  assert.equal(
    d.observations[4].reason,
    "price_qualified_waiting_confirmation",
  );
  assert.equal((d.observations[4].estimated_ev * 100).toFixed(2), "2.32");
  assert.equal((d.observations[5].estimated_ev * 100).toFixed(2), "-1.55");
  assert.equal(
    (Date.parse(d.observations[5].observed_at) -
      Date.parse(d.observations[4].observed_at)) /
      1000,
    332.401,
  );
  assert.ok(
    d.observations.every(
      (r) => r.action === "WATCH" && r.paper_play_id === null,
    ),
  );
});
