// utils/realizedRoi.js
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const toISO = (v) => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(SHEETS_EPOCH_MS + v * 86400000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const d = new Date(s.replace(/\b(ET|EST|EDT)\b/i, "UTC"));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    const d2 = new Date(s);
    return Number.isNaN(d2.getTime()) ? null : d2.toISOString();
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return null;
};

const AM_KEYS   = ["Odds Taken (AM)", "Odds (Am)", "American Odds", "Odds", "Odds_American"];
const DEC_KEYS  = ["Odds Taken (Dec)", "Closing Odds (Dec)", "Decimal Odds"];

function americanToDecimal(am) {
  const o = Number(am);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}
function decimalFromRow(row) {
  const amKey  = AM_KEYS.find(k => row[k] != null && row[k] !== "");
  const decKey = DEC_KEYS.find(k => row[k] != null && row[k] !== "");
  if (decKey) {
    const d = Number(row[decKey]);
    if (Number.isFinite(d) && d > 1) return d;
  }
  if (amKey) return americanToDecimal(row[amKey]);
  return null;
}
function stakeFromRow(row, defaultStake = 100) {
  const k = ["Stake", "Risk", "Stake Placed"].find(x => row[x] != null && row[x] !== "");
  const v = Number(row[k]);
  return Number.isFinite(v) && v > 0 ? v : defaultStake;
}
function resultFromRow(row) {
  // 1 = win, 0 = loss, 'P'/'Push' = push (no change)
  const r = row["Prediction Result"] ?? row["Result"] ?? row["Outcome"];
  if (r === "P" || String(r).toLowerCase() === "push") return "push";
  if (String(r) === "1") return "win";
  if (String(r) === "0") return "loss";
  if (typeof r === "number") return r > 0 ? "win" : "loss";
  return null; // unknown → skip
}

export function computeRealizedRoi(picks, bankrollStart = 1000) {
  const timeKeys = ["Game Time", "Timestamp", "Commence Time"];

  const sorted = [...picks].sort((a, b) => {
    const aISO = toISO(a["Game Time"] ?? a.Timestamp ?? a["Commence Time"]);
    const bISO = toISO(b["Game Time"] ?? b.Timestamp ?? b["Commence Time"]);
    const ta = aISO ? Date.parse(aISO) : Number.MAX_SAFE_INTEGER;
    const tb = bISO ? Date.parse(bISO) : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  let br = Number(bankrollStart) || 1000;
  let peak = br, maxDD = 0;
  let wins = 0, losses = 0, pushes = 0;

  const history = [{ date: 0, bankroll: Number(br.toFixed(2)) }];

  for (const row of sorted) {
    const dec = decimalFromRow(row);
    const res = resultFromRow(row);
    const stake = stakeFromRow(row);

    const tISO = toISO(timeKeys.map(k => row[k]).find(v => v != null)) || new Date().toISOString();
    if (!Number.isFinite(dec) || !res) {
      history.push({ date: tISO, bankroll: Number(br.toFixed(2)) });
      continue;
    }

    let pnl = 0;
    if (res === "win") {
      pnl = stake * (dec - 1);           // net winnings
      wins++;
    } else if (res === "loss") {
      pnl = -stake;
      losses++;
    } else {
      pushes++;
    }

    br += pnl;
    peak = Math.max(peak, br);
    maxDD = Math.max(maxDD, peak - br);
    history.push({ date: tISO, bankroll: Number(br.toFixed(2)) });
  }

  const profit = Number((br - (Number(bankrollStart) || 1000)).toFixed(2));
  const n = wins + losses; // exclude pushes
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const roiPercent = (Number(bankrollStart) || 1000) > 0 ? (profit / (Number(bankrollStart) || 1000)) * 100 : 0;

  return {
    history,
    roiPercent,
    winRate,
    profit,
    drawdown: Number(maxDD.toFixed(2)),
    wins, losses, pushes,
  };
}
