// pages/api/picks.ts
// Read the AllBets sheet and expose helpers to fetch today's or historical picks.
// Dynamic + fuzzy team matching for robust "yesterday's pick" lookups.
// Adds an API handler with two routes:
//   - GET /api/picks?q=... [&nocache=1]
//   - GET /api/picks/history?teams=A&teams=B&date=...&sport=... [&nocache=1]

import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { DateTime } from "luxon";
import fs from "node:fs";

/* =========================
   Config / Constants
   ========================= */
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const SHEET_ID = (process.env.GOOGLE_SHEET_ID || "").trim();
const TAB_NAME = process.env.GOOGLE_WORKSHEET_NAME || "AllBets";
const TZ = process.env.TZ || "America/New_York";
const CACHE_MS = Number(process.env.PICKS_CACHE_MS || 45_000);

if (!SHEET_ID) {
  throw new Error("Missing env GOOGLE_SHEET_ID. Use the ID between /d/ and /edit.");
}

/* =========================
   Auth / Sheets client
   ========================= */
function loadServiceAccount() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    let j: any;
    try {
      j = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } catch {
      throw new Error("GOOGLE_CREDENTIALS_JSON is not valid JSON.");
    }
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

  const jwt = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: "v4", auth: jwt });
  return { sheets, jwt, client_email };
}

/* =========================
   Utils
   ========================= */
type TeamIndex = { normToCanon: Map<string, string>; canonSet: Set<string> };
let _cache: {
  rows: any[] | null;
  ts: number;
  teamIndex: TeamIndex | null;
} = { rows: null, ts: 0, teamIndex: null };

const normalize = (s = "") =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const keyify = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Seed aliases
const TEAM_ALIASES_SEED: Record<string, string[]> = {
  "new york yankees": ["yanks", "nyy"],
  "boston red sox": ["bos", "redsox"],
  "chicago white sox": ["whitesox", "cws", "chi sox"],
  "baltimore ravens": ["bal"],
  "detroit lions": ["det lions"],
};

const SPORT_ALIASES: Record<string, string> = {
  nfl: "americanfootball_nfl",
  ncaaf: "americanfootball_ncaaf",
  cfb: "americanfootball_ncaaf",
  mlb: "baseball_mlb",
  nba: "basketball_nba",
  ncaab: "basketball_ncaab",
  nhl: "icehockey_nhl",
  mls: "soccer_usa_mls",
  ligue1: "soccer_france_ligue_one",
};

function normalizeSport(s: string | null | undefined) {
  if (!s) return "";
  const k = normalize(s).replace(/\s+/g, "_");
  if (SPORT_ALIASES[k]) return SPORT_ALIASES[k];
  if (SPORT_ALIASES[s.toLowerCase()]) return SPORT_ALIASES[s.toLowerCase()];
  return k;
}

function diceCoefficient(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (x: string) => {
    const out: string[] = [];
    for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2));
    return out;
  };
  const A = grams(a), B = grams(b);
  const setB = new Set(B);
  let hits = 0;
  for (const g of A) if (setB.has(g)) hits++;
  return (2 * hits) / (A.length + B.size);
}

function parseLocalTime(s = ""): DateTime | null {
  const tries = [
    DateTime.fromFormat(s, "LLL d, h:mm a z", { zone: TZ }),
    DateTime.fromFormat(s, "LLL d, yyyy, h:mm a z", { zone: TZ }),
    DateTime.fromFormat(s, "LLL d, h:mm a", { zone: TZ }),
    DateTime.fromFormat(s, "LLL d, yyyy, h:mm a", { zone: TZ }),
    DateTime.fromISO(s, { zone: TZ }),
  ];
  for (const d of tries) if (d.isValid) return d;
  return null;
}

type DateRange = { start: DateTime; end: DateTime };

function parseDateHint(text = ""): DateRange {
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

/* =========================
   Header resolver
   ========================= */
const H = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function makeColResolver(headers: any[]) {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(H(String(h)), i));

  function col(names: string[]) {
    for (const name of names) {
      const k = H(name);
      if (map.has(k)) return map.get(k)!;
      for (const [hk, idx] of map.entries()) {
        if (hk.includes(k)) return idx;
      }
    }
    return -1;
  }

  return {
    take: (row: any[], names: string[], def = "") => {
      const i = col(names);
      if (i === -1) return def;
      return (row[i] ?? def).toString().trim();
    },
    takeNum: (row: any[], names: string[]) => {
      const v = (row[col(names)] ?? "").toString().trim();
      const n = Number(String(v).replace(/[^\d.\-]+/g, ""));
      return Number.isFinite(n) ? n : undefined;
    },
  };
}

/* =========================
   Read & map AllBets
   ========================= */
async function readAllBets(nocache = false) {
  const now = Date.now();
  if (!nocache && _cache.rows && now - _cache.ts < CACHE_MS) return _cache.rows;

  const { sheets, jwt, client_email } = getSheetsClient();
  await jwt.authorize();
  if (process.env.NODE_ENV !== "production") {
    console.log(`[picks/auth] authorized as ${client_email}`);
  }

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A1:ZZ`,
  });

  const [headers = [], ...rows] = (data.values || []) as any[][];
  if (process.env.NODE_ENV !== "production") {
    console.log("[picks/debug] first headers:", headers.slice(0, 16));
  }
  const R = makeColResolver(headers);

  const mapped = rows
    .map((r) => ({
      ts_local: R.take(r, ["Game Time","Kickoff (Local)","Start Time (Local)","GameTime","start_time_local"]),
      sport: R.take(r, ["sport","Sport"]),
      league: R.take(r, ["League"]),
      home: R.take(r, ["Home Team","Home","home"]),
      away: R.take(r, ["Away Team","Away","away"]),
      market: R.take(r, ["Market","Bet Type","Wager Type"]),
      pick_side: R.take(r, ["Pick","Side","Selection"]),
      line: R.take(r, ["Line","Total","Spread"]),
      american_odds: R.take(r, ["Best American Odds","American Odds","Odds (US)","american_odds"]),
      decimal_odds: R.take(r, ["Best Decimal Odds","Decimal Odds","decimal_odds"]),
      reason: R.take(r, ["Why","Reason","Comment","Notes"]),
      movement: R.take(r, ["Movement","Recent movement","Line Movement"]),
      bet_id: R.take(r, ["bet_id","Bet ID","ID"]),
      ev_percent: R.take(r, ["EV %","EV%","EV Pct","ev_percent"]),
      kelly_pct: R.take(r, ["Kelly %","Kelly Pct","kelly_pct"]),
      pro: R.take(r, ["Pro","Tier","Plan"]),
      confidence: R.take(r, ["Confidence"]),
    }))
    .filter((r) => r.home || r.away);

  if (process.env.NODE_ENV !== "production") {
    const missTs = mapped.filter((x) => !x.ts_local).length;
    console.log(`[picks/debug] mapped rows=${mapped.length} | missing ts_local=${missTs}`);
  }

  _cache.rows = mapped;
  _cache.ts = now;
  _cache.teamIndex = null;
  return mapped;
}

/* =========================
   Dynamic team index / matching
   ========================= */
function buildTeamIndex(rows: any[]): TeamIndex {
  const normToCanon = new Map<string, string>();
  const canonSet = new Set<string>();

  const add = (name?: string) => {
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

  for (const [canon, aliases] of Object.entries(TEAM_ALIASES_SEED)) {
    add(canon);
    for (const alias of aliases) normToCanon.set(keyify(alias), canon);
  }

  return { normToCanon, canonSet };
}

async function ensureTeamIndex(nocache = false) {
  if (!nocache && _cache.teamIndex) return _cache.teamIndex!;
  const rows = await readAllBets(nocache);
  _cache.teamIndex = buildTeamIndex(rows);
  if (process.env.NODE_ENV !== "production") {
    console.log("[picks/teams] index built:", _cache.teamIndex.canonSet.size, "teams");
  }
  return _cache.teamIndex!;
}

async function canonicalizeTeams(rawTeams: string[] = [], nocache = false) {
  const { normToCanon } = await ensureTeamIndex(nocache);
  const out: string[] = [];
  for (const t of rawTeams) {
    const key = keyify(t);
    if (!key) continue;

    let canon = normToCanon.get(key);
    if (canon) {
      if (!out.includes(canon)) out.push(canon);
      continue;
    }

    let bestCanon: string | null = null;
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

/* =========================
   Public helpers
   ========================= */
export async function getPickForQuery(q = "", nocache = false) {
  const rows = await readAllBets(nocache);
  const { start, end } = parseDateHint(q);
  const now = DateTime.now().setZone(TZ);

  // same-day window
  let candidates = rows.filter((r: any) => {
    const dt = parseLocalTime(r.ts_local);
    if (!dt) return false;
    if (dt < start || dt > end) return false;
    return r.market || r.pick_side;
  });

  // next-up fallback (36h)
  if (!candidates.length) {
    const limit = now.plus({ hours: 36 });
    candidates = rows.filter((r: any) => {
      const dt = parseLocalTime(r.ts_local);
      return dt && dt >= now && dt <= limit && (r.market || r.pick_side);
    });
  }
  if (!candidates.length) return null;

  // earliest upcoming first (or earliest within the day)
  candidates.sort((a: any, b: any) => {
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
    ev_percent: r.ev_percent || undefined,
    kelly_pct: r.kelly_pct || undefined,
    pro: r.pro || undefined,
    confidence: r.confidence || undefined,
  };
}

export type HistoricalPickQuery = {
  teams?: string[];
  dateHint?: string | Date | number | null | undefined;
  sport?: string | null;
  expandOneDayIfEmpty?: boolean;
  nocache?: boolean;
};

export type HistoricalPickResult =
  | {
      matchup: string;
      sport: string;
      market: string;
      pick: string;
      line?: string | number | null;
      american_odds?: string | number | null;
      decimal_odds?: number | string | null;
      reason?: string;
      movement?: string;
      bet_id?: string;
      game_time_local?: string;
      startTimeISO?: string;
      ev_percent?: string | number | null;
      kelly_pct?: string | number | null;
      pro?: string | null;
      confidence?: string | null;
    }
  | null;

export async function findHistoricalPick({
  teams = [],
  dateHint = null,
  sport = null,
  expandOneDayIfEmpty = true,
  nocache = false,
}: HistoricalPickQuery = {}): Promise<HistoricalPickResult> {
  const rows = await readAllBets(nocache);

  const dr0: DateRange | null =
    dateHint != null ? parseDateHint(String(dateHint)) : null;

  const canonicalTeams = await canonicalizeTeams(teams ?? [], nocache);

  const withinRange = (r: any, range: DateRange | null) => {
    if (!range) return true;
    const dt = parseLocalTime(r.ts_local);
    return !!(dt && dt >= range.start && dt <= range.end);
  };

  const teamOK = (r: any) => {
    if (!canonicalTeams.length) return true;
    return canonicalTeams.every(
      (t: string) => matchTeam(r.home, t) || matchTeam(r.away, t)
    );
  };

  const sportKey = normalizeSport(sport || "");

  let rangeToUse: DateRange | null = dr0;

  let candidates = rows.filter((r: any) => {
    if (sportKey && normalizeSport(r.sport || r.league) !== sportKey) return false;
    if (!withinRange(r, rangeToUse)) return false;
    return teamOK(r);
  });

  // widen ±1 day if nothing
  if (!candidates.length && dr0 && expandOneDayIfEmpty) {
    const start = dr0.start.minus({ days: 1 });
    const end = dr0.end.plus({ days: 1 });
    rangeToUse = { start, end };
    candidates = rows.filter((r: any) => {
      if (sportKey && normalizeSport(r.sport || r.league) !== sportKey) return false;
      if (!withinRange(r, rangeToUse)) return false;
      return teamOK(r);
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[picks/history] qTeams=%j canon=%j sport=%s range=%s..%s candidates=%d",
      teams,
      canonicalTeams,
      sportKey || "any",
      rangeToUse ? rangeToUse.start.toISODate() : "any",
      rangeToUse ? rangeToUse.end.toISODate() : "any",
      candidates.length
    );
  }

  if (!candidates.length) return null;

  // Score:
  //  - +10 if both teams matched
  //  - +0.2 if total market
  //  - + recency scaled
  const scored = candidates
    .map((r: any) => {
      const dt = parseLocalTime(r.ts_local) || DateTime.fromMillis(0);
      let score = dt.toMillis() / 1e8;
      const bothTeams = canonicalTeams.length >= 2 &&
        (matchTeam(r.home, canonicalTeams[0]) || matchTeam(r.away, canonicalTeams[0])) &&
        (matchTeam(r.home, canonicalTeams[1]) || matchTeam(r.away, canonicalTeams[1]));
      if (bothTeams) score += 10;
      if (/total/i.test(r.market)) score += 0.2;
      return { r, score };
    })
    .sort((a: any, b: any) => b.score - a.score);

  const best = scored[0].r;
  const dt = parseLocalTime(best.ts_local);

  const away = (best.away ?? "").toString().trim();
  const home = (best.home ?? "").toString().trim();

  return {
    matchup: `${away} @ ${home}`,
    sport: (best.sport || best.league || "").toString(),
    market: (best.market ?? "").toString(),
    pick: (best.pick_side || best.market || "").toString(),
    line: best.line ?? null,
    american_odds: best.american_odds ?? null,
    decimal_odds: best.decimal_odds ?? null,
    reason: (best.reason || best.movement || "").toString(),
    movement: (best.movement || "").toString(),
    bet_id: (best.bet_id || "").toString(),
    game_time_local: best.ts_local,
    startTimeISO: dt ? dt.toISO() ?? undefined : undefined,
    ev_percent: best.ev_percent ?? null,
    kelly_pct: best.kelly_pct ?? null,
    pro: best.pro ?? null,
    confidence: best.confidence ?? null,
  };
}

/* =========================
   API Handler
   ========================= */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const path = (req.query.history ? "history" : "").toString();
    const nocache = String(req.query.nocache || "") === "1";

    if (path === "history") {
      const teamsQ = req.query.teams;
      const teams = Array.isArray(teamsQ) ? teamsQ : teamsQ ? [String(teamsQ)] : [];
      const dateHint = req.query.date ? String(req.query.date) : null;
      const sport = req.query.sport ? String(req.query.sport) : null;

      const result = await findHistoricalPick({
        teams,
        dateHint,
        sport,
        expandOneDayIfEmpty: true,
        nocache,
      });
      return res.status(200).json({ ok: true, result });
    }

    // default: today/next pick with optional q=
    const q = req.query.q ? String(req.query.q) : "";
    const result = await getPickForQuery(q, nocache);
    return res.status(200).json({ ok: true, result });
  } catch (err: any) {
    console.error("[/api/picks] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}
