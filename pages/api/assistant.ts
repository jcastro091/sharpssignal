// pages/api/assistant.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getPickForQuery, findHistoricalPick } from "./picks";

/* ======================= Types ======================= */
type QuoteMsg = {
  type: "quote";
  matchup: { home: string; away: string; league?: string; startTimeISO?: string };
  market: "h2h" | "spread" | "total";
  sideLabel: string;
  best: { book: string; price: string | number; line?: string; side?: string; link?: string };
  others?: { book: string; price: string | number; line?: string; side?: string; link?: string }[];
  note?: string;
};
type PickMsg = {
  type: "pick";
  matchup: { home: string; away: string; league?: string; startTimeISO?: string };
  recommendation: string;
  reason: string;
  evPct?: number;
  suggestedStakePct?: number;
  proFeature?: boolean;
};
type FaqMsg = { type: "faq"; answer: string };
type ErrorMsg = { type: "error"; message: string };
type Msg = QuoteMsg | PickMsg | FaqMsg | ErrorMsg;

/* ======================= Intent helpers ======================= */
function hasDateHint(s: string): boolean {
  return (
    /\byesterday\b|\blast night\b/i.test(s) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(s) || // 2025-09-22
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}\b/i.test(s) // Sep 22
  );
}
function isPickIntent(s: string): boolean {
  return /\b(explain|why)\b.*\bpick\b/i.test(s) || /\bpick\b/i.test(s);
}
function isQuoteIntent(s: string): boolean {
  // includes schedule-style phrasing to route to odds (we’ll show opponent + prices)
  return /best odds|moneyline|ml\b|spread|total|h2h|who do .* play|who are .* playing/i.test(s);
}
function marketFrom(q: string): "h2h" | "spread" | "total" {
  const s = q.toLowerCase();
  if (/\bspread|[-+]\d+(\.5)?/.test(s)) return "spread";
  if (/\btotal|over|under|o\/u\b/.test(s)) return "total";
  return "h2h";
}
function sideLabelFrom(q: string) {
  const m = q.toLowerCase().match(/\b(over|under)\b/);
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : "Selection";
}
function faqAnswer(q: string) {
  const s = q.toLowerCase();
  if (s.includes("sign up")) return "Sign up at sharps-signal.com/subscribe (Free & Pro).";
  if (s.includes("who are you") || s.includes("about"))
    return "We’re SharpsSignal—AI + live odds and limits to surface value picks with explanations. Bet responsibly.";
  if (s.includes("pricing")) return "See /subscribe for current Pro pricing.";
  if (s.includes("terms")) return "See /legal#terms.";
  if (s.includes("privacy")) return "See /legal#privacy.";
  return "Ask me for best odds, today’s pick, or yesterday’s pick (I’ll show the reason).";
}

/* ======================= Team dictionary (cached) ======================= */
type TeamIndex = {
  normToCanonical: Map<string, string>;
  canonicals: Set<string>;
  loadedAt: number;
};
let TEAM_INDEX: TeamIndex | null = null;
const TEAM_REFRESH_MS = 15 * 60 * 1000;

function normalizeTeamKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}
const SEED_TEAMS = [
  "New York Yankees",
  "Boston Red Sox",
  "Chicago White Sox",
  "Detroit Tigers",
  "Chicago Cubs",
  "Los Angeles Dodgers",
  "Baltimore Orioles",
  "Seattle Mariners",
  "Houston Astros",
  "Texas Rangers",
  "Detroit Lions",
  "Baltimore Ravens",
];

async function loadTeamIndexFromSheetSafe(): Promise<TeamIndex> {
  try {
    const normToCanonical = new Map<string, string>();
    const canonicals = new Set<string>();
    for (const t of SEED_TEAMS) {
      normToCanonical.set(normalizeTeamKey(t), t);
      canonicals.add(t);
    }
    const dateHints = ["yesterday", "2 days ago", "3 days ago", "last night"];
    for (const hint of dateHints) {
      const row = await findHistoricalPick({ dateHint: hint }).catch(() => null);
      if (!row) continue;
      const m = (row.matchup || "").split(" @ ");
      const away = (m[0] || (row as any).away || "").trim();
      const home = (m[1] || (row as any).home || "").trim();
      if (away) {
        normToCanonical.set(normalizeTeamKey(away), away);
        canonicals.add(away);
      }
      if (home) {
        normToCanonical.set(normalizeTeamKey(home), home);
        canonicals.add(home);
      }
    }
    return { normToCanonical, canonicals, loadedAt: Date.now() };
  } catch {
    const normToCanonical = new Map<string, string>();
    const canonicals = new Set<string>();
    for (const t of SEED_TEAMS) {
      normToCanonical.set(normalizeTeamKey(t), t);
      canonicals.add(t);
    }
    return { normToCanonical, canonicals, loadedAt: Date.now() };
  }
}
async function ensureTeamIndexFresh() {
  if (!TEAM_INDEX || Date.now() - TEAM_INDEX.loadedAt > TEAM_REFRESH_MS) {
    TEAM_INDEX = await loadTeamIndexFromSheetSafe();
    if (process.env.NODE_ENV !== "production") {
      console.log("[assistant] Team index loaded", {
        count: TEAM_INDEX.canonicals.size,
        seeds: SEED_TEAMS.length,
      });
    }
  }
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

  const A = grams(a);
  const B = grams(b);
  const setB = new Set(B);

  let hits = 0;
  for (const g of A) if (setB.has(g)) hits++;

  // 👇 this was `A.length + B.size` (B is an array)
  return (2 * hits) / (A.length + setB.size);
}



async function extractTeams(q: string): Promise<string[]> {
  await ensureTeamIndexFresh();
  const idx = TEAM_INDEX!;
  const raw = q.toLowerCase();
  const words = raw.split(/[^a-z0-9]+/).filter(Boolean);
  const normPhrase = normalizeTeamKey(raw);
  const normWords = words.map((w) => normalizeTeamKey(w)).filter(Boolean);
  const candidates = new Set<string>([normPhrase, ...normWords, ...words]);
  const scores: { canonical: string; score: number }[] = [];
  for (const [normKey, canonical] of idx.normToCanonical.entries()) {
    let best = 0;
    for (const c of candidates) best = Math.max(best, diceCoefficient(normKey, normalizeTeamKey(c)));
    if (best >= 0.45) scores.push({ canonical, score: best });
  }
  scores.sort((a, b) => b.score - a.score);
  const unique: string[] = [];
  for (const { canonical } of scores) {
    if (!unique.includes(canonical)) unique.push(canonical);
    if (unique.length >= 2) break;
  }
  return unique;
}

/* ======================= Handler ======================= */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Msg>) {
  if (req.method !== "POST") {
    res.status(405).json({ type: "error", message: "Use POST { q | message }" });
    return;
  }
  const q = String((req.body?.q ?? req.body?.message ?? "")).trim();
  if (!q) {
    res.status(400).json({ type: "error", message: "Missing q/message" });
    return;
  }
  const s = q.toLowerCase();

  try {
    /* ---- Odds shopping (H2H/spread/total + schedule phrasing) ---- */
    if (isQuoteIntent(s)) {
      const host =
        (req.headers["x-forwarded-host"] as string) ||
        (req.headers.host as string) ||
        "localhost:3000";
      const proto = (req.headers["x-forwarded-proto"] as string) || "http";

      const r = await fetch(`${proto}://${host}/api/odds-shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!r.ok) {
        return res.status(200).json({ type: "error", message: `odds-shop returned ${r.status}` });
      }

      const j = await r.json();
      if (!j?.event || !Array.isArray(j?.results)) {
        return res.status(200).json({ type: "error", message: "No odds found." });
      }

      const best = j.results[0];
      const others = j.results.slice(1);

      return res.status(200).json({
        type: "quote",
        matchup: {
          home: j.event.home,
          away: j.event.away,
          league: j.event.league,
          startTimeISO: j.event.startTimeISO,
        },
        market: marketFrom(q),
        sideLabel: sideLabelFrom(q),
        best: {
          book: String(best.book),
          price: best.price,
          line: best.line,
          side: best.side,
          link: best.link,
        },
        others: others.map((r: any) => ({
          book: String(r.book),
          price: r.price,
          line: r.line,
          side: r.side,
          link: r.link,
        })),
        note: j.note,
      });
    }

    /* ---- Picks (today first, then historical) ---- */
    if (isPickIntent(s) || hasDateHint(s)) {
      const teams = await extractTeams(q);
      if (process.env.NODE_ENV !== "production") {
        console.log("[assistant] pick request", { q, teams, dateHint: hasDateHint(s) });
      }

      const live = await getPickForQuery(q).catch(() => null);
      if (live) {
        return res.status(200).json({
          type: "pick",
          matchup: {
            home: (live as any).home,
            away: (live as any).away,
            league: (live as any).league,
            startTimeISO: (live as any).startTimeISO,
          },
          recommendation: `${(live as any).pick}${(live as any).odds ? ` @ ${(live as any).odds}` : ""}`,
          reason: (live as any).reason || "Model signal and line movement support this side.",
          evPct: (live as any).ev_percent,
          suggestedStakePct: (live as any).kelly_pct,
          proFeature: !!(live as any).pro,
        });
      }

      const hist = await findHistoricalPick({ dateHint: q, teams }).catch(() => null);
      if (hist) {
        const rec =
          (hist as any).market && /total/i.test((hist as any).market)
            ? `${(hist as any).pick ?? ""}${(hist as any).line ? ` ${(hist as any).line}` : ""}${
                (hist as any).american_odds ? ` @ ${(hist as any).american_odds}` : ""
              }`
            : `${(hist as any).pick ?? ""}${
                (hist as any).american_odds ? ` @ ${(hist as any).american_odds}` : ""
              }`;

        const parts = ((hist as any).matchup || "").split(" @ ");
        const away = parts[0] || (hist as any).away || "Away";
        const home = parts[1] || (hist as any).home || "Home";

        return res.status(200).json({
          type: "pick",
          matchup: {
            home,
            away,
            league: (hist as any).sport || (hist as any).league,
            startTimeISO: (hist as any).startTimeISO,
          },
          recommendation: rec || "See sheet row",
          reason: (hist as any).reason || (hist as any).movement || "Historical pick context.",
          evPct: (hist as any).ev_percent,
          suggestedStakePct: (hist as any).kelly_pct,
          proFeature: !!(hist as any).pro,
        });
      }

      return res.status(200).json({ type: "error", message: "No pick found for that time window." });
    }

    /* ---- FAQ fallback ---- */
    return res.status(200).json({ type: "faq", answer: faqAnswer(q) });
  } catch (e: any) {
    return res.status(200).json({ type: "error", message: e?.message || "Server error" });
  }
}
