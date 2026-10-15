// Run only against the local mock configuration in docs/price-comparison.md.
require("node:fs").mkdirSync("work", { recursive: true });
const http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const now = Date.now(),
  base = "http://sharps.local.test:3025";
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "owner@local.test",
  email_confirmed_at: new Date(now - 3600000).toISOString(),
  user_metadata: { interests: ["sports"] },
  aud: "authenticated",
};
const token = [
  Buffer.from("{}").toString("base64url"),
  Buffer.from(
    JSON.stringify({
      ...user,
      sub: user.id,
      exp: Math.floor(now / 1000) + 3600,
    }),
  ).toString("base64url"),
  "mock",
].join(".");
const play = {
  entry_id: "original-entry",
  play_key: "original-play",
  cohort: "Original forward",
  event: "event-one",
  sport: "baseball_mlb",
  market: "h2h",
  side: "Cleveland Guardians",
  home: "Cleveland Guardians",
  away: "Tampa Bay Rays",
  book: "betrivers",
  decimal: 1.8,
  start: (now + 3600000) / 1000,
  entry_at: (now - 3600000) / 1000,
};
process.env.SUPABASE_URL = "http://127.0.0.1:4025";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-service";
process.env.ODDS_API_KEY = "local-odds";
const rawFetch = global.fetch;
let providerCalls = 0,
  missing = false;
global.fetch = async (url, options) => {
  if (new URL(url).hostname === "api.the-odds-api.com") {
    providerCalls++;
    return {
      ok: true,
      json: async () => ({
        id: play.event,
        sport_key: play.sport,
        home_team: play.home,
        away_team: play.away,
        commence_time: new Date(play.start * 1000).toISOString(),
        bookmakers: missing
          ? []
          : [
              {
                key: "draftkings",
                last_update: new Date().toISOString(),
                markets: [
                  {
                    key: "h2h",
                    outcomes: [{ name: play.side, price: 1 + 100 / 122 }],
                  },
                ],
              },
            ],
      }),
    };
  }
  return rawFetch(url, options);
};
const backend = require(
  require("node:path").join(
    process.env.SPORTS_REPO ||
      require("node:path").resolve(__dirname, "../../sports"),
    "pages/api/member-prices",
  ),
);
const service = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const url = new URL(req.url, "http://127.0.0.1:4025");
  if (req.method === "OPTIONS") return res.end();
  if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (url.pathname === "/rest/v1/customer_entitlements") return res.end("[]");
  if (url.pathname === "/rest/v1/member_publication_settings")
    return res.end('[{"paused":false}]');
  if (url.pathname === "/rest/v1/rpc/customer_delayed_research")
    return res.end(
      JSON.stringify([
        { payload: play, seen_at: new Date(now - 3600000).toISOString() },
      ]),
    );
  if (url.pathname === "/api/member-feed")
    return res.end(
      JSON.stringify({
        status: "available",
        feed_mode: "delayed",
        plays: [play],
      }),
    );
  if (url.pathname === "/api/member-prices") {
    req.query = Object.fromEntries(url.searchParams);
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (v) => res.end(JSON.stringify(v));
    return backend(req, res);
  }
  res.statusCode = 404;
  res.end("{}");
});
(async () => {
  await new Promise((r) => service.listen(4025, "127.0.0.1", r));
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
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: JSON.stringify([token, "local-refresh", null, null, null]),
        domain: "sharps.local.test",
        path: "/",
      },
    ]);
    await context.addInitScript(() =>
      localStorage.setItem("ss_analytics_consent", "no"),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/dashboard");
    await page.locator(".latest-signal-card").waitFor();
    assert.equal(providerCalls, 0);
    await page
      .getByText("Choose your sportsbooks for price comparisons", {
        exact: true,
      })
      .click();
    await page.getByLabel("Betting location").selectOption("NY");
    await page.getByLabel("DraftKings", { exact: true }).check();
    const card = page.locator(".latest-signal-card").first();
    await card
      .getByText("Best observed: -122 · DraftKings", { exact: true })
      .waitFor();
    await card.getByText("Original signal:", { exact: true }).waitFor();
    assert.equal(providerCalls, 1);
    assert.ok((await card.innerText()).includes("-125 · BetRivers"));
    await card
      .getByRole("button", { name: "Tail this pick", exact: true })
      .click();
    const dialog = page.locator("dialog[open]");
    await dialog
      .getByText("Best observed: -122 · DraftKings", { exact: true })
      .waitFor();
    assert.equal(await dialog.locator("input[name=odds]").inputValue(), "-125");
    assert.equal(providerCalls, 1);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await card.screenshot({ path: "work/price-card-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await card.screenshot({ path: "work/price-card-mobile.png" });
    await page.getByLabel("FanDuel", { exact: true }).check();
    await card
      .getByRole("status")
      .filter({ hasText: "Checking" })
      .waitFor({ state: "hidden" });
    await card
      .getByText("Compare selected sportsbooks", { exact: true })
      .click();
    assert.ok((await card.innerText()).includes("Unavailable"));
    // Feed record has started: no pregame quote can remain actionable.
    await page.route("**/api/member-feed?*", (route) =>
      route.fulfill({
        json: {
          status: "available",
          plays: [{ ...play, start: (Date.now() - 1000) / 1000 }],
        },
      }),
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page
      .locator(".latest-signal-card")
      .getByText("Pregame market closed.", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: browser preferences → Next proxy → actual backend authorization/publication → provider fixture → -122 vs original -125; tracking dialog preserves actual-entry fields; no hidden-dialog requests; mobile/desktop; unavailable and closed states.",
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
