// pages/api/odds-shop.ts
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Live Odds Shopping using The Odds API
 * Docs: https://the-odds-api.com/
 *
 * Query examples:
 *  - "best odds for yankees moneyline"
 *  - "braves today"
 *  - "who do the yankees play today?"
 */

type OddsRow = { book: string; price: number; line?: string; side?: string; link?: string };
type Payload = {
  event?: { away: string; home: string; league?: string; startTimeISO?: string };
  slots?: { market: "h2h" | "spread" | "total"; line?: string };
  results?: OddsRow[];
  note?: string;
  error?: string;
};

// Config from env
const API_KEY = process.env.ODDS_API_KEY || "";
const REGION = process.env.ODDS_API_REGION || "us";
const BOOKS = (process.env.ODDS_API_BOOKS || "")
  .split(",")
  .map((b) => b.trim())
  .filter(Boolean);

const SPORTS = {
  MLB: "baseball_mlb",
  NFL: "americanfootball_nfl",
  NBA: "basketball_nba",
  NHL: "icehockey_nhl",
} as const;

const DEFAULT_SPORT = "NBA" as const; // you can switch to NFL/NBA in-season

// Minimal MLB dictionary with common aliases (extend as needed)
const TEAM_ALIASES: Record<string, string[]> = {
  "New York Yankees": ["yankees", "nyy"],
  "Boston Red Sox": ["red sox", "bos", "sox (boston)"],
  "Atlanta Braves": ["braves", "atl"],
  "New York Mets": ["mets", "nym"],
  "Los Angeles Dodgers": ["dodgers", "lad", "la dodgers"],
  "San Francisco Giants": ["giants", "sf", "sfg"],
  "San Diego Padres": ["padres", "sd", "sd padres"],
  "Chicago Cubs": ["cubs", "chc"],
  "Chicago White Sox": ["white sox", "cws", "whitesox", "chi sox"],
  "St. Louis Cardinals": ["cardinals", "stl"],
  "Houston Astros": ["astros", "hou"],
  "Texas Rangers": ["rangers", "tex"],
  "Seattle Mariners": ["mariners", "sea"],
  "Toronto Blue Jays": ["blue jays", "jays", "tor"],
  "Baltimore Orioles": ["orioles", "bal"],
  "Tampa Bay Rays": ["rays", "tb", "tampa"],
  "Cleveland Guardians": ["guardians", "cle"],
  "Minnesota Twins": ["twins", "min"],
  "Kansas City Royals": ["royals", "kc"],
  "Detroit Tigers": ["tigers", "det"],
  "Los Angeles Angels": ["angels", "laa"],
  "Oakland Athletics": ["athletics", "a's", "oakland", "oak"],
  "Colorado Rockies": ["rockies", "col"],
  "Arizona Diamondbacks": ["diamondbacks", "dbacks", "ari"],
  "Milwaukee Brewers": ["brewers", "mil"],
  "Pittsburgh Pirates": ["pirates", "pit"],
  "Cincinnati Reds": ["reds", "cin"],
  "Miami Marlins": ["marlins", "mia"],
  "Washington Nationals": ["nationals", "was", "washington nats"],
  "Philadelphia Phillies": ["phillies", "phi"],
  
  
  
  // --- NBA (minimal starter set; extend as you like) ---
  "Boston Celtics": ["celtics", "bos celtics", "boston celtics"],
  "Milwaukee Bucks": ["bucks", "milwaukee bucks", "mil bucks"],
  "Los Angeles Lakers": ["lakers", "la lakers", "lal"],
  "Golden State Warriors": ["warriors", "gsw", "golden state"],
  "New York Knicks": ["knicks", "nyk"],
  "Brooklyn Nets": ["nets", "bkn"],
};

function normalize(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function detectLeague(q: string): keyof typeof SPORTS {
  const s = normalize(q);

  if (/\bnfl|football\b/.test(s)) return "NFL";
  if (/\bnhl|hockey\b/.test(s)) return "NHL";

  // If user explicitly mentions NBA/basketball
  if (/\bnba|basketball\b/.test(s)) return "NBA";

  // If they mention common NBA team names, treat as NBA
  if (/\bceltics|lakers|warriors|bucks|nuggets|heat|suns|mavs|mavericks|knicks|nets|bulls\b/.test(s)) {
    return "NBA";
  }

  // Otherwise default
  return DEFAULT_SPORT;
}

function findTeamsInQuery(q: string): string[] {
  const s = normalize(q);
  const hits: string[] = [];
  for (const [canon, aliases] of Object.entries(TEAM_ALIASES)) {
    const needles = [normalize(canon), ...aliases.map(normalize)];
    if (needles.some((n) => s.includes(n))) hits.push(canon);
  }
  return Array.from(new Set(hits)).slice(0, 2);
}

// "moneyline" / "ml" / "h2h" → h2h (default). Spread/total not implemented here.
function detectMarket(q: string): "h2h" | "spread" | "total" {
  const s = normalize(q);
  if (/\bspread|[-+]\d+(\.5)?\b/.test(s)) return "spread";
  if (/\btotal|over|under|o\/u\b/.test(s)) return "total";
  return "h2h";
}

// Best American odds = numerically highest value
function pickBest(rows: OddsRow[]): OddsRow[] {
  const sorted = [...rows].sort((a, b) => b.price - a.price);
  return sorted;
}

// Map TheOddsAPI bookmaker keys to neat names
const BOOK_NAME: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  pointsbetus: "PointsBet",
};

function prettyBook(id: string) {
  return BOOK_NAME[id] || id.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

async function fetchOdds(sportKey: string) {
  const base = "https://api.the-odds-api.com/v4/sports";
  const params = new URLSearchParams({
    apiKey: API_KEY,
    regions: REGION,
    markets: "h2h",
    oddsFormat: "american",
    dateFormat: "iso",
  });
  if (BOOKS.length) params.set("bookmakers", BOOKS.join(","));
  const url = `${base}/${sportKey}/odds?${params.toString()}`;
  const r = await fetch(url, { next: { revalidate: 15 } }); // 15s cache on Vercel/Next
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`TheOddsAPI ${r.status}: ${text}`);
  }
  return r.json(); // array of events
}

function matchEvent(events: any[], wantedTeams: string[]) {
  if (!events?.length) return null;

  // If both teams provided, require both; otherwise accept single-team match
  const wantA = wantedTeams[0]?.toLowerCase();
  const wantB = wantedTeams[1]?.toLowerCase();

  const scored = events
    .map((ev: any) => {
      const home = (ev.home_team || "").toLowerCase();
      const away = (ev.away_team || "").toLowerCase();
      let score = 0;
      if (wantA && (home.includes(wantA) || away.includes(wantA))) score += 1;
      if (wantB && (home.includes(wantB) || away.includes(wantB))) score += 1;
      return { ev, score };
    })
    .sort((a: any, b: any) => b.score - a.score);

  return scored[0]?.score ? scored[0].ev : null;
}

function rowsForSide(ev: any, sideTeam: string): OddsRow[] {
  const out: OddsRow[] = [];
  for (const bk of ev.bookmakers || []) {
    const bookId = bk.key;
    const h2h = (bk.markets || []).find((m: any) => m.key === "h2h");
    if (!h2h) continue;
    const outc = h2h.outcomes || [];
    const side = outc.find((o: any) => normalize(o.name) === normalize(sideTeam));
    if (!side || typeof side.price !== "number") continue;

    out.push({
      book: prettyBook(bookId),
      price: side.price,
      side: side.name,
      link: undefined, // If you have affiliate links, map them by bookId here.
    });
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Payload>) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const query = String((req.body?.query ?? req.body?.q ?? "")).trim();
  if (!query) {
    res.status(400).json({ error: "Missing 'query' (or 'q')." });
    return;
  }

  if (!API_KEY) {
    res.status(200).json({
      note: "Configure ODDS_API_KEY in .env.local",
      results: [],
      event: { away: "Away", home: "Home", league: DEFAULT_SPORT },
      slots: { market: "h2h" },
    });
    return;
  }

  try {
    const league = detectLeague(query);
    const sportKey = SPORTS[league] || SPORTS[DEFAULT_SPORT];
    const wantTeams = findTeamsInQuery(query);
    const market = detectMarket(query);
	
	console.log("[odds-shop] query", {
	  query,
	  league,
	  sportKey,
	  wantTeams,
	  market,
	  region: REGION,
	  books: BOOKS,
	});

    // Only h2h for now (that’s what you asked about)
    if (market !== "h2h") {
      res.status(200).json({ error: "Only H2H supported for now.", slots: { market } as any });
      return;
    }

    const events = await fetchOdds(sportKey);

    // If user didn’t specify teams (e.g., “best odds for moneyline today”), return the top upcoming event
    let ev = wantTeams.length ? matchEvent(events, wantTeams) : events?.[0];

    if (!ev) {
      res.status(200).json({ error: "No upcoming event matched that query." });
      return;
    }

    // Decide which side the user wants: if they said a team, use that; else default to away team
    const sideTeam = wantTeams[0] || ev.away_team;

    const rows = rowsForSide(ev, sideTeam);
	console.log("[odds-shop] matched event", {
	  home: ev.home_team,
	  away: ev.away_team,
	  rows: rows.length,
	});

    if (!rows.length) {
      res.status(200).json({
        event: {
          away: ev.away_team,
          home: ev.home_team,
          league,
          startTimeISO: ev.commence_time,
        },
        slots: { market: "h2h" },
        results: [],
        note: "No books returned a price for that side yet.",
      });
      return;
    }

    const sorted = pickBest(rows); // best first
    res.status(200).json({
      event: {
        away: ev.away_team,
        home: ev.home_team,
        league,
        startTimeISO: ev.commence_time,
      },
      slots: { market: "h2h" },
      results: sorted,
      note: rows.length < 2 ? "Limited book coverage in this region right now." : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
}
