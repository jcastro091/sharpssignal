// Explicit labelled verification; no customer accounts, messages or payments created.
const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
const { summarize } = require("../lib/growthReport.cjs");
const base = process.env.GROWTH_TEST_URL || "http://localhost:3018";
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY,
);
(async () => {
  const id = "evt_qa_" + crypto.randomUUID();
  const body = {
    event_id: id,
    event_name: "site_click",
    visitor_id: "v_qa_" + crypto.randomUUID(),
    session_id: "s_qa_" + crypto.randomUUID(),
    page_path: "/blog/why-we-passed-marlins-diamondbacks",
    page_url:
      base +
      "/blog/why-we-passed-marlins-diamondbacks?private=must-not-persist",
    metadata: {
      test: true,
      revision: "2026-10-08-v1",
      device: "mobile",
      x: 40,
      y: 60,
      target: "article_signup",
      password: "must-not-persist",
    },
  };
  const send = (b) =>
    fetch(base + "/api/events", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify(b),
    });
  for (let i = 0; i < 2; i++) {
    const r = await send(body);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).persisted, true);
  }
  const rows = await db.from("funnel_events").select("*").eq("event_id", id);
  assert.ifError(rows.error);
  assert.equal(rows.data.length, 1);
  assert.ok(!JSON.stringify(rows.data).includes("must-not-persist"));
  assert.equal(summarize(rows.data).events, 0);
  assert.equal((await send({ event_name: "subscribe_success" })).status, 400);
  assert.equal((await fetch(base + "/api/growth-analytics")).status, 403);
  // Exercise the real DB and Stripe reads independently of the separately tested auth gate.
  const source =
    fs
      .readFileSync("pages/api/growth-analytics.js", "utf8")
      .replace(/import[\s\S]*?from ["'][^"']+["'];/g, "")
      .replace(
        "export default async function handler",
        "async function handler",
      ) + "\nmodule.exports=handler;";
  const sandbox = {
    module: { exports: {} },
    require: () => ({ summarize }),
    Stripe,
    process,
    AbortSignal,
    getCeoAccess: async () => ({ allowed: true }),
    createSupabaseServiceClient: () => db,
  };
  vm.runInNewContext(source, sandbox);
  let status = 200,
    report;
  await sandbox.module.exports(
    { method: "GET", query: { days: "7" } },
    {
      setHeader() {},
      status(n) {
        status = n;
        return this;
      },
      json(d) {
        report = d;
        return this;
      },
    },
  );
  assert.equal(status, 200);
  assert.equal(report.ok, true);
  const result = {
    at: new Date().toISOString(),
    base,
    write_readback: true,
    duplicate_suppressed: true,
    private_payload_removed: true,
    qa_excluded: true,
    forged_payment_rejected: true,
    unauthenticated_report_forbidden: true,
    real_report_sources_loaded: true,
    payments_available: report.payments_available,
    truncated: report.truncated,
    payments_truncated: report.payments_truncated,
  };
  fs.mkdirSync("out/growth", { recursive: true });
  fs.writeFileSync(
    "out/growth/verification-" +
      (base.includes("localhost") ? "local" : "production") +
      ".json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
