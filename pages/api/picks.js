// pages/api/picks.js
// Read the AllBets sheet and expose helpers to fetch today's or historical picks.
// (Upgraded) Dynamic + fuzzy team matching for robust "yesterday's pick" lookups.

import { google } from "googleapis";
import { DateTime } from "luxon";
import fs from "node:fs";

const SCOPES   = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const SHEET_ID = (process.env.GOOGLE_SHEET_ID || "").trim();
const TAB_NAME = process.env.GOOGLE_WORKSHEET_NAME || "AllBets";
const TZ       = process.env.TZ || "America/New_York";
const CACHE_MS = Number(process.env.PICKS_CACHE_MS || 45_000);

if (!SHEET_ID) {
  throw new Error("Missing env GOOGLE_SHEET_ID. Use the ID between /d/ and /edit.");
}

// ---------- Credentials loader (JSON blob OR separate vars OR file path) ----------
function loadServiceAccount() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    let j;
    try { j = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON); }
    catch { throw new Error("GOOGLE_CREDENTIALS_JSON is not valid JSON."); }
    return {
      client_email: j.client_email,
      private_key: String(j.private_key || "").replace(/\\n/g, "\n"),
      source: "JSON",
    };
  }
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: String(process.env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, "\n"),
      source: "SEPARATE_VARS",
    };
  }
  if (process.env.GOOGLE_CREDENTIALS_FILE) {
    const raw = fs.readFileSync(process.env.GOOGLE_CREDENTIALS_FILE, "utf8");
    const j = JSON.parse(raw);
    return {
      client_email: j.client_email,
      private_key: String(j.private_key || "").replace(/\\n/g, "\n"),
      source: "FILE",
    };
  }
  throw new Error(
    "No Google creds. Set GOOGLE_CREDENTIALS_JSON or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (or GOOGLE_CREDENTIALS_FILE for dev)."
  );
}

function getSheetsClient() {
  const { client_email, private_key, source } = loadServiceAccount();

  // 🔎 SAFE logger (no secrets)
  if (process.env.NODE_ENV !== "production") {
    const keyLen = (private_key || "").length;
    const hasBegin = /BEGIN PRIVATE KEY/.test(private_key || "");
    const hasNL = (private_key || "").includes("\n");
    console.log(
      `[picks/auth] source=${source} sa=${client_email} | keyLen=${keyLen} | hasBEGIN=${hasBegin} | hasNewlines=${hasNL}`
    );
    console.log(`[picks/auth] sheet=${SHEET_ID} tab=${TAB_NAME}`);
  }

  if (!client_email || !private_key) {
    throw new Error("Service account missing client_email/private_key (check envs).");
  }

  // ✅ options object form
  const jwt = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: "v4", auth: jwt });
  return { sheets, jwt, client_email };
}

// ---------- Utils ----------
let _cache = { rows: null, ts: 0, teamIndex: null };

const normalize = (s = "") =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const keyify = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Seed aliases (still helpful)
const TEAM_ALIASES_SEED = {
  "new york yankees": ["yanks", "nyy"],
  "boston red sox": ["bos", "redsox"],
  "chicago white sox": ["whitesox", "cws", "chi sox"],
  "baltimore ravens": ["bal"],
  "detroit lions": ["det lions"],
};

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (x) => {
    const out = [];
    for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2));
    return out;
  };
  const A = grams(a), B = grams(b);
  const setB = new Set(B);
  let hits = 0;
  for (const g of A) if (setB.has(g)) hits++;
  return (2 * hits) / (A.length + B.size);
}

// Flexible local time parsing
function parseLocalTime(s = "") {
  const tries = [
    DateTime.fromFormat(s, "LLL d, h:mm a z", { zone: TZ }),
    DateTime.fromFormat(s, "LLL d, yyyy, h:mm a z", { zone: TZ }),
    DateTime.fromFormat(s, "LLL d, h:mm a", { zone: TZ }), // no tz in cell
    DateTime.fromFormat(s, "LLL d, yyyy, h:mm a", { zone: TZ }),
    DateTime.fromISO(s, { zone: TZ }),
  ];
  for (const d of tries) if (d.isValid) return d;
  return null;
}

function parseDateHint(text = "") {
  const t = text.toLowerCase();
  const base = DateTime.now().setZone(TZ).startOf("day");
  if (/\byesterday\b|\blast night\b/.test(t)) {
    const start = base.minus({ days: 1 });
    return { start, end: start.endOf("day") };
  }
  const m = t.match(/\b(20\d{2}-\d{2}-\d{2}|[0-1]?\d\/[0-3]?\d\/20\d{2}|[a-z]{3,9}\.? ?\d{1,2})\b/i);
  if (m) {
    const token = m[1];
    const fmts = ["yyyy-LL-dd", "LL/dd/yyyy", "LLL d, yyyy", "LLL d"];
    for (const f of fmts) {
      const dt = DateTime.fromFormat(token, f, { zone: TZ });
      if (dt.isValid) {
        const d = f === "LLL d" ? dt.set({ year: DateTime.now().year }) : dt;
        return { start: d.startOf("day"), end: d.endOf("day") };
      }
    }
  }
  return { start: base, end: base.endOf("day") }; // default: today
}

// ----------- Header resolver (handles synonyms / spacing / case) -----------
const H = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function makeColResolver(headers) {
  const map = new Map();
  headers.forEach((h, i) => map.set(H(String(h)), i));

  function col(names) {
    for (const name of names) {
      const k = H(name);
      if (map.has(k)) return map.get(k);
      // fuzzy contains
      for (const [hk, idx] of map.entries()) {
        if (hk.includes(k)) return idx;
      }
    }
    return -1;
  }

  return {
    take: (row, names, def = "") => {
      const i = col(names);
      if (i === -1) return def;
      return (row[i] ?? def).toString().trim();
    },
    debug: () => Object.fromEntries(map.entries()),
  };
}

// ----------- Read & map the AllBets sheet -----------
async function readAllBets() {
  const now = Date.now();
  if (_cache.rows && now - _cache.ts < CACHE_MS) return _cache.rows;

  const { sheets, jwt, client_email } = getSheetsClient();
  await jwt.authorize();
  if (process.env.NODE_ENV !== "production") {
    console.log(`[picks/auth] authorized as ${client_email}`);
  }

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A1:ZZ`,
  });

  const [headers = [], ...rows] = (data.values || []);
  if (process.env.NODE_ENV !== "production") {
    console.log("[picks/debug] first headers:", headers.slice(0, 12));
  }
  const R = makeColResolver(headers);

  const mapped = rows
    .map((r) => ({
      ts_local: R.take(r, ["Game Time", "Kickoff (Local)", "Start Time (Local)", "GameTime", "start_time_local"]),
      sport: R.take(r, ["sport", "Sport"]),
      league: R.take(r, ["League"]),
      home: R.take(r, ["Home Team", "Home", "home"]),
      away: R.take(r, ["Away Team", "Away", "away"]),
      market: R.take(r, ["Market", "Bet Type", "Wager Type"]),
      pick_side: R.take(r, ["Pick", "Side", "Selection"]),
      line: R.take(r, ["Line", "Total", "Spread"]),
      american_odds: R.take(r, ["Best American Odds", "American Odds", "Odds (US)", "american_odds"]),
      decimal_odds: R.take(r, ["Best Decimal Odds", "Decimal Odds", "decimal_odds"]),
      reason: R.take(r, ["Why", "Reason", "Comment", "Notes"]),
      movement: R.take(r, ["Movement", "Recent movement", "Line Movement"]),
      bet_id: R.take(r, ["bet_id", "Bet ID", "ID"]),
    }))
    .filter((r) => r.home || r.away);

  if (process.env.NODE_ENV !== "production") {
    const missTs = mapped.filter((x) => !x.ts_local).length;
    console.log(`[picks/debug] mapped rows=${mapped.length} | missing ts_local=${missTs}`);
  }

  _cache.rows = mapped;
  _cache.ts = now;
  _cache.teamIndex = null; // force re-build next call
  return mapped;
}

// ----------- Build dynamic team index -----------
function buildTeamIndex(rows) {
  // Maps normalized key -> canonical
  const normToCanon = new Map();
  const canonSet = new Set();

  const add = (name) => {
    if (!name) return;
    const canon = name.trim();
    const key = keyify(canon);
    normToCanon.set(key, canon);
    canonSet.add(canon);
  };

  for (const r of rows) {
    add(r.home);
    add(r.away);
  }

  // add seed aliases
  for (const [canon, aliases] of Object.entries(TEAM_ALIASES_SEED)) {
    add(canon);
    for (const alias of aliases) {
      normToCanon.set(keyify(alias), canon);
    }
  }

  return { normToCanon, canonSet };
}

async function ensureTeamIndex() {
  if (_cache.teamIndex) return _cache.teamIndex;
  const rows = await readAllBets();
  _cache.teamIndex = buildTeamIndex(rows);
  if (process.env.NODE_ENV !== "production") {
    console.log("[picks/teams] index built:", _cache.teamIndex.canonSet.size, "teams");
  }
  return _cache.teamIndex;
}

// ----------- Team matching -----------
async function canonicalizeTeams(rawTeams = []) {
  const { normToCanon } = await ensureTeamIndex();
  const out = [];
  for (const t of rawTeams) {
    const key = keyify(t);
    if (!key) continue;

    // exact or alias
    let canon = normToCanon.get(key);
    if (canon) {
      if (!out.includes(canon)) out.push(canon);
      continue;
    }

    // fuzzy: try all keys
    let bestCanon = null;
    let bestScore = 0;
    for (const [k, c] of normToCanon.entries()) {
      const s = diceCoefficient(k, key);
      if (s > bestScore) {
        bestScore = s;
        bestCanon = c;
      }
    }
    if (bestCanon && bestScore >= 0.45) {
      if (!out.includes(bestCanon)) out.push(bestCanon);
    }
  }
  return out;
}

function matchTeam(cell = "", canonicalTeam = "") {
  const c = normalize(cell);
  const q = normalize(canonicalTeam);
  if (!c || !q) return false;
  return c.includes(q);
}

// ----------- Public helpers -----------
export async function getPickForQuery(q = "") {
  const rows = await readAllBets();
  const { start, end } = parseDateHint(q);
  const now = DateTime.now().setZone(TZ);

  // same-day window
  let candidates = rows.filter((r) => {
    const dt = parseLocalTime(r.ts_local);
    if (!dt) return false;
    if (dt < start || dt > end) return false;
    return (r.market || r.pick_side);
  });

  // next-up fallback (36h)
  if (!candidates.length) {
    const limit = now.plus({ hours: 36 });
    candidates = rows.filter((r) => {
      const dt = parseLocalTime(r.ts_local);
      return dt && dt >= now && dt <= limit && (r.market || r.pick_side);
    });
  }
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const da = (parseLocalTime(a.ts_local) || DateTime.fromMillis(0)).toMillis();
    const db = (parseLocalTime(b.ts_local) || DateTime.fromMillis(0)).toMillis();
    return da - db;
  });

  const r = candidates[0];
  const dt = parseLocalTime(r.ts_local);
  const recommendation = r.pick_side || `${r.market}${r.line ? ` ${r.line}` : ""}`;

  return {
    home: r.home,
    away: r.away,
    league: r.league || r.sport || "",
    startTimeISO: dt ? dt.toISO() : undefined,
    pick: recommendation,
    odds: r.american_odds || undefined,
    reason: r.reason || r.movement || "",
    ev_percent: undefined,
    kelly_pct: undefined,
    pro: undefined,
  };
}

export async function findHistoricalPick({
  teams = [],
  dateHint = null,
  sport = null,
  expandOneDayIfEmpty = true,   // new: widen window if exact date has no rows
} = {}) {
  const rows = await readAllBets();
  const dr0 = dateHint ? parseDateHint(dateHint) : null;

  // Canonicalize team names with dynamic + fuzzy index
  const canonicalTeams = await canonicalizeTeams(teams);

  const withinRange = (r, range) => {
    if (!range) return true;
    const dt = parseLocalTime(r.ts_local);
    return dt && dt >= range.start && dt <= range.end;
  };

  const teamOK = (r) => {
    if (!canonicalTeams.length) return true;
    return canonicalTeams.every((t) => matchTeam(r.home, t) || matchTeam(r.away, t));
  };

  let rangeToUse = dr0;
  let candidates = rows.filter((r) => {
    if (sport && normalize(r.sport) !== normalize(sport)) return false;
    if (!withinRange(r, rangeToUse)) return false;
    return teamOK(r);
  });

  // widen ±1 day if empty and allowed
  if (!candidates.length && dr0 && expandOneDayIfEmpty) {
    const start = dr0.start.minus({ days: 1 });
    const end = dr0.end.plus({ days: 1 });
    rangeToUse = { start, end };
    candidates = rows.filter((r) => {
      if (sport && normalize(r.sport) !== normalize(sport)) return false;
      if (!withinRange(r, rangeToUse)) return false;
      return teamOK(r);
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[picks/history] qTeams=%j canon=%j range=%s..%s candidates=%d",
      teams,
      canonicalTeams,
      rangeToUse ? rangeToUse.start.toISODate() : "any",
      rangeToUse ? rangeToUse.end.toISODate() : "any",
      candidates.length
    );
  }

  if (!candidates.length) return null;

  const scored = candidates
    .map((r) => {
      const dt = parseLocalTime(r.ts_local) || DateTime.fromMillis(0);
      let score = dt.toMillis() / 1e8;         // recency
      if (/total/i.test(r.market)) score += 0.2;
      if (canonicalTeams.length >= 2) score += 10;   // both teams matched
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0].r;
  const dt = parseLocalTime(best.ts_local);

  return {
    matchup: `${best.away} @ ${best.home}`,
    sport: best.sport || best.league || "",
    market: best.market,
    pick: best.pick_side || best.market,
    line: best.line,
    american_odds: best.american_odds,
    decimal_odds: best.decimal_odds,
    reason: best.reason || best.movement || "",
    movement: best.movement || "",
    bet_id: best.bet_id || "",
    game_time_local: best.ts_local,
    startTimeISO: dt ? dt.toISO() : undefined,
  };
}
