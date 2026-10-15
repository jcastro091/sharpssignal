const test = require("node:test"),
  assert = require("node:assert/strict");
const { quoteState } = require("../lib/priceComparison.cjs");
const now = Date.now(),
  play = { start: (now + 3600000) / 1000 };
test("client drops an aging best quote without waiting for a new server fetch", () => {
  const data = {
    quotes: [
      {
        book: "draftkings",
        status: "current",
        decimal: 1.82,
        observed_at: new Date(now).toISOString(),
      },
    ],
  };
  assert.equal(quoteState(play, data, now).best.book, "draftkings");
  assert.equal(quoteState(play, data, now + 121000).best, null);
  assert.equal(quoteState(play, data, now + 121000).status, "stale");
  assert.equal(
    quoteState({ ...play, start: (now - 1) / 1000 }, data, now).status,
    "closed",
  );
});
test("invalid, future and unavailable quotes never rank as best", () => {
  for (const q of [
    {
      status: "unavailable",
      decimal: 2,
      observed_at: new Date(now).toISOString(),
    },
    { status: "current", decimal: 0, observed_at: new Date(now).toISOString() },
    {
      status: "current",
      decimal: 2,
      observed_at: new Date(now + 10000).toISOString(),
    },
  ])
    assert.equal(quoteState(play, { quotes: [q] }, now).best, null);
});
