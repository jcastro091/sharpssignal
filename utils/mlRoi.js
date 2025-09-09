// utils/mlRoi.js
// Pull ML probabilities from a separate service and compute expected ROI/Bankroll.

// ---------- Google Sheets date parsing ----------
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30); // 1899-12-30

function parseSheetDateToISO(v) {
  if (v === null || v === undefined) return null;

  // numeric (Sheets serial)
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = SHEETS_EPOCH_MS + v * 86400000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // string
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    // normalize ET → UTC so Date parses
    const norm = s.replace(/\b(ET|EST|EDT)\b/i, "UTC");
    const d = new Date(norm);
    if (!Number.isNaN(d.getTime())) return d.toISOString();

    const d2 = new Date(s);
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();
    return null;
  }

  // Date
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();

  return null;
}

// ---------- odds & math helpers ----------
function americanToDecimal(oddsAm) {
  const o = Number(oddsAm);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function kellyFractionFromProb(p, dec) {
  const b = dec - 1, q = 1 - p;
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.max(0, (b * p - q) / b);
}

function expectedEVPerDollar(p, dec) {
  if (!Number.isFinite(dec)) return 0;
  const winPayout = dec - 1;
  return p * winPayout - (1 - p);
}

// ---------- inline prob fallback ----------
function inferProbFromRow(row) {
  const p =
    row.Probability ??
    row.ML_Prob ??
    row.Predicted_Prob ??
    row.ModelProb ??
    row.model_prob ??
    (typeof row.Predicted === "number" ? row.Predicted : null);

  if (p == null) return null;
  const f = parseFloat(p);
  if (!Number.isFinite(f)) return null;
  // allow 0–1 or 0–100
  const v = f > 1 ? f / 100 : f;
  return clamp01(v);
}

// ---------- server call (proxy) ----------
async function fetchProbsFromProxy(betIds) {
  if (!betIds.length) return {};
  const r = await fetch(`/api/probs?bet_ids=${encodeURIComponent(betIds.join(","))}`);
  if (!r.ok) return {};
  const { probs = {} } = await r.json().catch(() => ({ probs: {} }));
  return probs;
}

// ---------- public API ----------
export async function computeMLRoiAsync(picks, bankroll = 1000, kellyFraction = 1) {
  const ids = picks.map(p => p.bet_id || p.BetID || p.Bet_Id || p.id).filter(Boolean);
  if (!ids.length) return emptyResult(bankroll);

  const probs = await fetchProbsFromProxy(ids);

  return computeFromProbs(picks, bankroll, kellyFraction, (row) => {
    const id = row.bet_id || row.BetID || row.Bet_Id || row.id;
    if (id && typeof probs[id] === "number") return clamp01(probs[id] > 1 ? probs[id] / 100 : probs[id]);
    return inferProbFromRow(row);
  });
}

export function computeMLRoi(picks, bankroll = 1000, kellyFraction = 1) {
  return computeFromProbs(picks, bankroll, kellyFraction, inferProbFromRow);
}

// ---------- core computation ----------
function computeFromProbs(picks, bankrollStart, kellyFraction, probGetter) {
  const oddsKeys = ["Odds Taken", "Odds (Am)", "American Odds", "Odds", "Odds_American"];
  const timeKeys = ["Game Time", "Timestamp", "Commence Time"];

  // sort by time if available
  const sorted = [...picks].sort((a, b) => {
    const aISO = parseSheetDateToISO(firstKey(a, timeKeys));
    const bISO = parseSheetDateToISO(firstKey(b, timeKeys));
    const ta = aISO ? Date.parse(aISO) : Number.MAX_SAFE_INTEGER;
    const tb = bISO ? Date.parse(bISO) : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  let br = Number(bankrollStart) || 1000;
  let peak = br;
  let maxDD = 0;
  let totalEV = 0;
  let probSum = 0;
  let n = 0;

  const history = [{ date: 0, bankroll: Number(br.toFixed(2)) }];

  for (const row of sorted) {
    const p = probGetter(row);
    const oddsKey = firstKey(row, oddsKeys);
    const dec = americanToDecimal(oddsKey ? row[oddsKey] : null);
    const tISO = parseSheetDateToISO(firstKey(row, timeKeys)) || new Date().toISOString();

    if (p == null || !Number.isFinite(dec)) {
      history.push({ date: tISO, bankroll: Number(br.toFixed(2)) });
      continue;
    }

    const fk = kellyFractionFromProb(p, dec);
    const stake = br * clamp01(fk) * clamp01(kellyFraction);

    const evPerDollar = expectedEVPerDollar(p, dec);
    const ev = stake * evPerDollar;

    br += ev;
    peak = Math.max(peak, br);
    maxDD = Math.max(maxDD, peak - br);
    totalEV += ev;
    probSum += p;
    n += 1;

    history.push({ date: tISO, bankroll: Number(br.toFixed(2)) });
  }

  const profit = Number((br - (Number(bankrollStart) || 1000)).toFixed(2));
  const roiPercent = (Number(bankrollStart) || 1000) > 0 ? (totalEV / (Number(bankrollStart) || 1000)) * 100 : 0;
  const winRate = n > 0 ? (probSum / n) * 100 : 0;

  return {
    history,
    roiPercent,
    winRate,
    profit,
    drawdown: Number(maxDD.toFixed(2)),
  };
}

function firstKey(obj, keys) {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== "") return k;
  return null;
}

function emptyResult(b) {
  return { history: [{ date: 0, bankroll: Number((b || 1000).toFixed(2)) }], roiPercent: 0, winRate: 0, profit: 0, drawdown: 0 };
}
