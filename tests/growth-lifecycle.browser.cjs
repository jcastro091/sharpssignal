// Local integration only. Run with Next on 3015 and the fake Supabase/backend on 4015.
// NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4015; no production credentials.
const http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "http://sharps.local.test:3015",
  now = Date.now();
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "owner@local.test",
  created_at: new Date(now - 3 * 86400000).toISOString(),
  email_confirmed_at: new Date(now - 3 * 86400000 + 1000).toISOString(),
  user_metadata: {
    interests: ["sports"],
    growth_acquisition: {
      version: "2026-10-15-v2",
      visitor_id: "v_initial_1234567890",
      utm_source: "x",
      utm_medium: "social",
      utm_campaign: "free",
      utm_content: "oct15",
    },
  },
};
const token = [
  Buffer.from("{}").toString("base64url"),
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      ...user,
      exp: Math.floor(now / 1000) + 3600,
    }),
  ).toString("base64url"),
  "mock",
].join(".");
const users = [user],
  events = [];
let unavailable = false;
const service = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  let body = "";
  for await (const c of req) body += c;
  if (req.method === "OPTIONS") return res.end();
  const url = new URL(req.url, "http://127.0.0.1:4015");
  if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (url.pathname === "/auth/v1/admin/users")
    return res.end(
      JSON.stringify({ users, aud: "authenticated", total: users.length }),
    );
  if (url.pathname === "/auth/v1/signup") {
    const input = JSON.parse(body);
    const u = {
      id: "00000000-0000-0000-0000-000000000002",
      aud: "authenticated",
      email: input.email,
      created_at: new Date().toISOString(),
      email_confirmed_at: null,
      user_metadata: input.data,
      identities: [{ id: "identity" }],
    };
    users.push(u);
    return res.end(JSON.stringify(u));
  }
  if (url.pathname === "/api/member-feed")
    return res.end(
      JSON.stringify({
        status: "available",
        observed_at: new Date().toISOString(),
        feed_mode: "delayed",
        plays: [
          {
            entry_id: "record-one",
            cohort: "sports",
            sport: "baseball_mlb",
            side: "Home",
            away: "New York Yankees",
            home: "Boston Red Sox",
            market: "h2h",
            decimal: 2.1,
            book: "draftkings",
            entry_at: new Date(now - 3600000).toISOString(),
            start: new Date(now + 3600000).toISOString(),
            result: "pending",
          },
        ],
      }),
    );
  if (url.pathname === "/rest/v1/funnel_events") {
    if (unavailable) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ message: "mock unavailable" }));
    }
    if (req.method === "POST") {
      const e = JSON.parse(body);
      if (!events.some((x) => x.event_id === e.event_id))
        events.push({ ...e, created_at: new Date().toISOString() });
      return res.end();
    }
    return res.end(JSON.stringify(events));
  }
  if (url.pathname === "/rest/v1/pick_waitlist") return res.end("[]");
  res.statusCode = 404;
  res.end(
    JSON.stringify({ error: "Unexpected local request", path: url.pathname }),
  );
});
(async () => {
  await new Promise((resolve) => service.listen(4015, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--no-proxy-server",
      "--host-resolver-rules=MAP sharps.local.test 127.0.0.1",
    ],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/api/notify-signup", (route) =>
      route.fulfill({ json: { ok: true } }),
    );
    const errors = [];
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      base +
        "/signup?utm_source=x&utm_medium=social&utm_campaign=free&utm_content=post_signup",
    );
    await page
      .getByRole("button", { name: "Allow analytics", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill("new@local.test");
    await page.locator("#password").fill("test-password-only");
    await page
      .getByRole("button", { name: "Create account", exact: false })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Confirm your email" })
      .waitFor();
    assert.equal(
      users[1].user_metadata.growth_acquisition.utm_content,
      "post_signup",
    );
    assert.equal(users[1].email_confirmed_at, null);
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: JSON.stringify([token, "local-test", null, null, null]),
        domain: "sharps.local.test",
        path: "/",
      },
    ]);
    // Declined analytics never sends record events, despite a signed record being present.
    await page.evaluate(() =>
      localStorage.setItem("ss_analytics_consent", "no"),
    );
    await page.goto(base + "/dashboard");
    const record = page.locator(".latest-signal-card").first();
    await record.waitFor();
    await record.scrollIntoViewIfNeeded();
    await page.waitForTimeout(5500);
    assert.equal(
      events.filter((e) => e.event_name === "record_view").length,
      0,
    );
    await page.evaluate(() => {
      localStorage.setItem("ss_analytics_consent", "yes");
      window.dispatchEvent(new Event("ss-consent"));
    });
    await page.waitForFunction(() => true);
    await page.waitForTimeout(6000);
    const viewed = events.find((e) => e.event_name === "record_view");
    assert.ok(
      viewed,
      "consented visible record must persist through the real API",
    );
    assert.equal(viewed.user_id, user.id);
    assert.equal(viewed.metadata.authenticated_record, "v1");
    assert.match(viewed.metadata.record_key, /^[a-f0-9]{64}$/);
    assert.equal(viewed.metadata.record_proof, undefined);
    const response = await page.evaluate(async () => {
      const r = await fetch("/api/growth-analytics?days=30");
      return { status: r.status, body: await r.json() };
    });
    assert.equal(response.status, 200);
    const report = response.body;
    assert.equal(report.lifecycle.conversions.created, 2);
    assert.equal(report.lifecycle.conversions.confirmed, 1);
    assert.equal(report.lifecycle.conversions.activated, 1);
    assert.equal(report.lifecycle.cohorts[0].d7.pending, 2);
    const body = JSON.stringify(report);
    assert.ok(!body.includes(user.id));
    assert.ok(!body.includes(user.email));
    await page.goto(base + "/analytics");
    await page
      .getByRole("heading", { name: "Verified membership conversions" })
      .waitFor();
    for (const heading of [
      "Sources that lead to conversion",
      "Signup-week retention",
      "Free membership",
      "Free-play email signup",
      "Paid subscription",
      "$5-pick interest",
      "Individual-pick purchase",
    ])
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    await page.screenshot({
      path: "work/analytics-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "work/analytics-mobile.png",
      fullPage: true,
    });
    unavailable = true;
    const broken = await page.evaluate(async () => {
      const r = await fetch("/api/growth-analytics?days=7");
      return { status: r.status, body: await r.json() };
    });
    assert.equal(broken.status, 503);
    assert.match(broken.body.error, /unavailable, not zero/);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: consented signup metadata → Auth facts; record view → authenticated API → event storage → activation/campaign/cohort report; private desktop/mobile dashboard; failure returns unavailable.",
    );
  } finally {
    await browser.close();
    service.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  service.close();
});
