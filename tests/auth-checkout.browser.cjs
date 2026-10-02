// Local-only: production build uses fake Supabase credentials; all browser writes are mocked.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = "http://127.0.0.1:3000";
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  email: "member@example.invalid",
  email_confirmed_at: "2026-10-01T00:00:00Z",
  user_metadata: { interests: ["sports"] },
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
const session = {
  access_token: token,
  refresh_token: "fake-local",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext();
    let mode = "hang",
      verification = "error",
      held,
      holdNavigation = false,
      heldNavigation;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname))
        return route.abort();
      if (url.pathname === "/api/events")
        return route.fulfill({ json: { ok: true } });
      if (url.pathname === "/api/member-feed")
        return route.fulfill({ json: { ok: true, plays: [] } });
      if (url.pathname === "/api/stripe/verify-success")
        return route.fulfill({
          status: verification === "error" ? 403 : 200,
          json:
            verification === "error"
              ? { ok: false, error: "checkout_not_eligible" }
              : {
                  ok: true,
                  paymentVerified: true,
                  fulfillment: "not_activated",
                },
        });
      if (
        holdNavigation &&
        /\/_next\/data\/.*\/dashboard.json/.test(url.pathname)
      ) {
        heldNavigation = route;
        return;
      }
      if (url.pathname === "/auth/v1/token") {
        if (mode === "hang") {
          held = route;
          return;
        }
        if (mode === "error")
          return route.fulfill({
            status: 400,
            json: { msg: "Local mock rejected sign in" },
          });
        return route.fulfill({ json: session });
      }
      if (url.pathname === "/auth/v1/user")
        return route.fulfill({ json: user });
      if (url.pathname === "/auth/v1/otp") return route.fulfill({ json: {} });
      return route.continue();
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const fill = async () => {
      await page.locator("#email").fill(user.email);
      await page.locator("#password").fill("local-test-password");
    };
    const submit = () =>
      page.getByRole("button", { name: "Log in ↗", exact: true });
    await page.goto(
      base +
        "/signin?next=" +
        encodeURIComponent(
          "/dashboard?checkout=success&session_id=cs_test_owned",
        ),
    );
    await fill();
    await submit().click();
    await page
      .getByRole("alert")
      .filter({ hasText: "taking too long" })
      .waitFor({ timeout: 18000 });
    assert.equal(await submit().isEnabled(), true);
    // A late auth failure must not overwrite the timeout state.
    await held.fulfill({ status: 400, json: { msg: "Late stale error" } });
    await page.waitForTimeout(250);
    assert.match(await page.locator(".error-message[role=alert]").innerText(), /taking too long/);
    mode = "error";
    await submit().click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Local mock rejected" })
      .waitFor();
    mode = "success";
    holdNavigation = true;
    await submit().click();
    await page
      .getByRole("alert")
      .filter({ hasText: "taking too long" })
      .waitFor({ timeout: 18000 });
    assert.equal(await submit().isEnabled(), true);
    assert.ok(heldNavigation);
    // Finish the already requested navigation, then verify the return status and retry UI.
    holdNavigation = false;
    await heldNavigation.continue();
    await page.waitForURL(
      "**/dashboard?checkout=success&session_id=cs_test_owned",
    );
    await page
      .getByRole("alert")
      .filter({ hasText: "could not verify" })
      .waitFor();
    verification = "verified";
    await page.getByRole("button", { name: "Retry verification" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Payment verified" })
      .waitFor();
    assert.equal(await page.locator('a[href*="t.me"]').count(), 0);
    await page.screenshot({
      path: "/tmp/sharpssignal-auth-checkout.png",
      fullPage: true,
    });
    const publicContext = await browser.newContext();
    await publicContext.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname))
        return route.abort();
      if (url.pathname === "/api/events")
        return route.fulfill({ json: { ok: true } });
      return route.continue();
    });
    const publicPage = await publicContext.newPage();
    await publicPage.goto(
      base + "/picks?checkout=success&session_id=cs_test_owned",
    );
    await publicPage.waitForURL("**/signin?next=*");
    assert.equal(
      new URL(publicPage.url()).searchParams.get("next"),
      "/dashboard?checkout=success&session_id=cs_test_owned",
    );
    await publicPage.goto(base + "/subscribe");
    assert.equal(
      (await publicPage
        .getByRole("link", { name: "Request access", exact: true })
        .count()) > 0,
      true,
    );
    assert.equal(
      await publicPage
        .getByRole("button", { name: /buy|pay|subscribe/i })
        .count(),
      0,
    );
    await publicPage.goto(base + "/welcome");
    assert.ok(
      (await publicPage.locator("main").innerText()).includes(
        "invitations are not activated",
      ),
    );
    await publicPage.setViewportSize({ width: 390, height: 844 });
    await publicPage.goto(base + "/signin");
    await publicPage.getByRole("button", { name: "Email me a link" }).click();
    await publicPage.locator("#email").fill(user.email);
    await publicPage.route("**/auth/v1/otp**", (route) =>
      route.fulfill({ json: {} }),
    );
    await publicPage
      .getByRole("button", { name: "Send secure sign-in link" })
      .click();
    await publicPage
      .getByRole("status")
      .filter({ hasText: "Check your inbox" })
      .waitFor();
    assert.equal(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: stuck auth/navigation, late error, retry, successful login, preserved redirects, fulfillment error/retry/disabled invite, OTP, mobile, purchasing disabled",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
