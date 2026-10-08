// Run against a local server configured ONLY with the mock auth service in review notes.
// PLAYWRIGHT_MODULE points to an installed playwright package; no live credentials needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = "http://127.0.0.1:3000";
const out = process.env.REVIEW_DIR || "/tmp/sharpssignal-review";
fs.mkdirSync(out, { recursive: true });
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "member@example.invalid",
  email_confirmed_at: "2026-10-01T00:00:00Z",
  user_metadata: { interests: ["sports", "markets"] },
};
const token = [
  Buffer.from("{}").toString("base64url"),
  Buffer.from(
    JSON.stringify({
      ...user,
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url"),
  "mock",
].join(".");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const events = [],
    errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  let feed = { ok: true, status: "available", plays: [] },
    responseStatus = 200,
    signupMode = "confirm",
    signupRequests = 0,
    signupBody;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname))
      return route.abort();
    if (url.pathname === "/api/events") {
      events.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true, persisted: false } });
    }
    if (url.pathname === "/api/member-feed")
      return route.fulfill({ status: responseStatus, json: feed });
    if (url.pathname === "/auth/v1/signup") {
      signupRequests++;
      signupBody = route.request().postDataJSON();
      if (signupMode === "error")
        return route.fulfill({
          status: 422,
          json: { msg: "Local mock signup rejected" },
        });
      return route.fulfill({
        json:
          signupMode === "session"
            ? {
                access_token: token,
                refresh_token: "local-test",
                expires_in: 3600,
                token_type: "bearer",
                user,
              }
            : user,
      });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = async (name) => {
    await page.screenshot({
      path: out + "/" + name + ".png",
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Viewport overflow: " + name,
    );
  };
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Less noise. More signal." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Find your signal" })
      .getAttribute("href"),
    "/signup",
  );
  await shot("home-desktop");
  await page.getByRole("link", { name: "Explore the preview" }).click();
  await page.getByText("How to read a sports record").waitFor();
  await shot("preview-desktop");
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page.getByText("Explore Markets at your pace.").waitFor();
  await page.goto(base + "/dashboard");
  await page.waitForURL("**/signin?next=%2Fdashboard");
  await page.goto(base + "/signup");
  await page.getByLabel("Email", { exact: true }).waitFor();
  assert.equal(await page.locator("input[type=tel]").count(), 0);
  assert(await page.getByLabel("Sports", { exact: true }).isChecked());
  assert(!(await page.getByLabel("Markets", { exact: true }).isChecked()));
  await page.getByRole("button", { name: "Create account" }).click();
  assert.equal(signupRequests, 0);
  assert.equal(
    await page.locator("#email").evaluate((el) => el.validity.valueMissing),
    true,
  );
  await page.getByLabel("Email", { exact: true }).fill("not-an-email");
  await page.getByRole("button", { name: "Create account" }).click();
  assert.equal(signupRequests, 0);
  await page
    .getByLabel("Email", { exact: true })
    .fill("member@example.invalid");
  await page.locator("#password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  assert.equal(signupRequests, 0);
  await page.locator("#password").fill("local-test-password");
  await page.getByLabel("Sports", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("alert").filter({ hasText: "Choose Sports" }).waitFor();
  assert.equal(signupRequests, 0);
  await shot("signup-validation-desktop");
  await page.getByLabel("Sports", { exact: true }).check();
  signupMode = "error";
  await page.getByRole("button", { name: "Create account" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Local mock signup rejected" })
    .waitFor();
  signupMode = "confirm";
  await page.getByRole("button", { name: "Create account" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your email" })
    .waitFor();
  assert.deepEqual(signupBody.data.interests, ["sports"]);
  assert(!("phone" in signupBody.data));
  await shot("signup-confirmation-desktop");
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: JSON.stringify([token, "local-test", null, null, null]),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto(base + "/dashboard");
  await page
    .getByRole("heading", { name: "No published records yet" })
    .waitFor();
  await shot("member-empty-desktop");
  assert.equal(await page.getByText("Admin workspace").count(), 0);
  feed = { ok: true, status: "no_qualifying_signals", plays: [] };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("heading", { name: "No qualifying signals", exact: true })
    .waitFor();
  feed = {
    ok: true,
    status: "available",
    observed_at: "2026-10-01T18:00:00Z",
    plays: [
      {
        entry_id: "mock-pending",
        side: "Example pending team",
        away: "Example A",
        home: "Example B",
        result: "pending",
        decimal: 2,
        arm: "Example cohort",
      },
      {
        entry_id: "mock-settled",
        side: "Example settled team",
        away: "Example C",
        home: "Example D",
        result: "loss",
        decimal: 1.9,
        clv_pct: 0.01,
        arm: "Example cohort",
      },
      { entry_id: "mock-missing", side: "Example unavailable result" },
    ],
  };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Open a record" }).waitFor();
  await page.getByText("How to read a sports record").click();
  await page.getByRole("button", { name: "Open a record" }).click();
  await page
    .getByRole("region", { name: "Opened member record" })
    .getByRole("heading", { name: "Example settled team" })
    .waitFor();
  await shot("member-record-desktop");
  await page.getByRole("button", { name: "Not yet", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Thanks for the feedback" })
    .waitFor();
  feed = { ...feed, status: "stale" };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText("Update delayed", { exact: true }).waitFor();
  await shot("member-stale-desktop");
  responseStatus = 503;
  feed = { error: "local mock unavailable" };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Data unavailable" })
    .waitFor();
  await shot("member-error-desktop");
  responseStatus = 200;
  feed = { ok: true, status: "unavailable", plays: [] };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Data unavailable" })
    .waitFor();
  feed = { ok: true, status: "available", publishing_paused: true, plays: [] };
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("heading", { name: "Publishing paused" }).waitFor();
  feed = {
    ok: true,
    status: "available",
    plays: [
      {
        trade_id: "mock-market",
        symbol: "EXAMPLE",
        direction: 1,
        status: "closed",
        entry_price: 1.1,
      },
    ],
  };
  await page.getByRole("button", { name: "▥ Markets", exact: true }).click();
  await page.getByText("EXAMPLE ↗").waitFor();
  assert.equal(
    await page.locator("tbody tr td").last().innerText(),
    "Unavailable",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("member-markets-mobile");
  feed = { ok: true, status: "available", plays: [] };
  await page.getByRole("button", { name: "↗ Sports", exact: true }).click();
  await page
    .getByRole("heading", { name: "No published records yet" })
    .waitFor();
  await shot("member-empty-mobile");
  responseStatus = 503;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await shot("member-error-mobile");
  await context.clearCookies();
  await page.goto(base);
  await shot("home-mobile");
  await page.goto(base + "/picks-preview");
  await shot("preview-mobile");
  await page.goto(base + "/signup");
  await shot("signup-mobile");
  const beforeMobile = signupRequests;
  await page.getByRole("button", { name: "Create account" }).click();
  assert.equal(signupRequests, beforeMobile);
  assert(
    await page.locator("#email").evaluate((el) => el.validity.valueMissing),
  );
  responseStatus = 200;
  feed = { ok: true, status: "available", plays: [] };
  signupMode = "session";
  await page
    .getByLabel("Email", { exact: true })
    .fill("member@example.invalid");
  await page.locator("#password").fill("local-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await page
    .getByRole("heading", { name: "No published records yet" })
    .waitFor();
  const memberEvents = events.filter((e) => e.location === "member_first_use");
  for (const name of [
    "signup_view",
    "signup_submit",
    "signup_success",
    "dashboard_view",
    "record_view",
    "member_guide_open",
    "member_feedback",
  ])
    assert(
      memberEvents.some((e) => e.event_name === name),
      "Missing event " + name,
    );
  for (const event of memberEvents)
    assert(
      !JSON.stringify(event).includes("member@example") &&
        !event.page_url &&
        !event.visitor_id &&
        !event.email,
    );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/browser-results.json",
    JSON.stringify(
      {
        passed: true,
        signupRequests,
        memberEvents: memberEvents.map((e) => e.event_name),
        consoleErrors: errors,
        screenshots: fs.readdirSync(out).filter((x) => x.endsWith(".png")),
      },
      null,
      2,
    ),
  );
  await browser.close();
  console.log(
    "Desktop/mobile first-use checks passed; all auth, feed and event writes used local mocks.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
