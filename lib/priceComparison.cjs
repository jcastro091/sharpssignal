const BOOKS = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  williamhill_us: "Caesars",
};
const time = (value) =>
  typeof value === "number" ? value * 1000 : Date.parse(value);
function quoteState(play, data, now = Date.now()) {
  if (
    (Number.isFinite(time(play.start)) && time(play.start) <= now) ||
    ["win", "loss", "push", "void", "won", "lost"].includes(
      String(play.result || "").toLowerCase(),
    ) ||
    data?.status === "closed"
  )
    return { status: "closed", quotes: [], best: null };
  const quotes = (data?.quotes || []).map((q) => {
    const age = now - time(q.observed_at);
    return {
      ...q,
      status:
        q.status === "unavailable" ||
        !Number.isFinite(q.decimal) ||
        q.decimal <= 1 ||
        !Number.isFinite(age) ||
        age < 0
          ? "unavailable"
          : age > 120000
            ? "stale"
            : "current",
    };
  });
  const best =
    quotes
      .filter((q) => q.status === "current")
      .sort((a, b) => b.decimal - a.decimal)[0] || null;
  return {
    status: best
      ? "available"
      : quotes.some((q) => q.status === "stale")
        ? "stale"
        : "unavailable",
    quotes,
    best,
  };
}
module.exports = { BOOKS, time, quoteState };
