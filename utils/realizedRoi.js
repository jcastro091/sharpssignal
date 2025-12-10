// utils/realizedRoi.js
// Realized (actual) bankroll path from AllObservations rows.
// Accepts flexible schemas and missing fields gracefully.

function toNumber(x, def = null) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function americanToDecimal(american) {
  const a = toNumber(american, null);
  if (a === null) return null;
  if (a >= 100) return 1 + a / 100;
  if (a <= -100) return 1 + 100 / Math.abs(a);
  return null;
}

function pickField(o, keys) {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

// ✅ allow API’s keys
function parseWhen(row) {
  const raw = row.ts_iso || row.ts_local || row["Game Time"] || row.Timestamp || row["Commence Time"];
  if (!raw) return null;
  if (typeof raw === "string") {
    const s = raw.replace(/\b(ET|EST|EDT)\b/i, "UTC").replace(" ", "T");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d2 = new Date(raw);
  return isNaN(d2.getTime()) ? null : d2.toISOString();
}

function getAmericanOdds(row) {
  let a = row["Odds (Am)"] ?? row["American Odds"] ?? row.american_odds ??
          row["LowVig Home Odds (Am)"] ?? row["LowVig Away Odds (Am)"] ??
          row["BetOnline Home Odds (Am)"] ?? row["BetOnline Away Odds (Am)"];
  if (a != null && a !== "") {
    const n = Number(String(a).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  const dec = row["Decimal Odds (Current)"] ?? row.decimal_odds ??
              row["Current Decimal"] ?? row["Peak Decimal"] ?? row["Opening Decimal"];
  if (dec != null) {
    const d = Number(String(dec).replace(/[^0-9.]/g, ""));
    if (d && d > 1) return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
  }
  return null;
}

function getResult(row) {
  const cands = [row.Result, row["Prediction Result"], row.result];
  for (const v of cands) {
    if (v === 0 || v === 1 || v === 2) return v;
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (s === "1" || s.startsWith("w")) return 1;
      if (s === "0" || s.startsWith("l")) return 0;
      if (s.startsWith("p")) return 2;
    }
  }
  return null;
}


export function computeRealizedRoi(rows, bankrollStart, opts = {}) {
  const kellyFraction = Number(opts.kellyFraction ?? 1);

  // Clean + sort
  const clean = (Array.isArray(rows) ? rows : [])
    .filter(r =>
      r?.ts &&
      Number.isFinite(r["Odds (Am)"]) &&
      Number.isFinite(r.Risk) &&
      (r.Prediction === 0 || r.Prediction === 1)
    )
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));

  let bankroll = Number(bankrollStart) || 0;
  let peak = bankroll;
  let maxDrawdown = 0;
  let wins = 0;
  let total = 0;
  const history = [];

  for (const r of clean) {
    const stake = Math.max(0, Number(r.Risk) * kellyFraction);
    const am = Number(r["Odds (Am)"]);
    // Convert American odds to gross win payout (excludes stake)
    const winPayout = am >= 100 ? (stake * am / 100) : (stake * 100 / Math.abs(am));
    const delta = r.Prediction === 1 ? winPayout : -stake;

    bankroll += delta;
    total += 1;
    if (r.Prediction === 1) wins += 1;

    peak = Math.max(peak, bankroll);
    maxDrawdown = Math.min(maxDrawdown, bankroll - peak);

    history.push({ date: r.ts_iso || r.ts, bankroll });
  }

  const profit = bankroll - bankrollStart;
  const roiPercent = bankrollStart > 0 ? (profit / bankrollStart) * 100 : 0;
  const winRate = total ? (wins / total) * 100 : 0;

  return {
    history,
    roiPercent,
    winRate,
    profit,
    drawdown: Math.abs(maxDrawdown),
  };
}
