// lib/odds.ts
export const ODDS_BASE = "https://api.the-odds-api.com/v4";

export function americanToDecimal(american: number): number {
  const o = Number(american);
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}

export function breakEvenProb(american: number): number {
  return 1 / americanToDecimal(american);
}

export function evPercent(p: number, american: number): number {
  const D = americanToDecimal(american);
  const b = D - 1;
  return (p * b - (1 - p)) * 100;
}

export async function listEvents(sportKey: string, hours = 24) {
  const url = `${ODDS_BASE}/sports/${sportKey}/events?daysFrom=${Math.max(1, Math.floor(hours/24))}&regions=${process.env.ODDS_API_REGION||"us"}&apiKey=${process.env.ODDS_API_KEY}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`listEvents ${r.status}`);
  return r.json();
}

export async function eventOdds(sportKey: string, eventId: string, markets = ["h2h"], bookmakers?: string[]) {
  const qp = new URLSearchParams({
    regions: process.env.ODDS_API_REGION || "us",
    markets: markets.join(","),
    oddsFormat: "american",
    apiKey: process.env.ODDS_API_KEY || "",
  });
  if (bookmakers?.length) qp.set("bookmakers", bookmakers.join(","));
  const url = `${ODDS_BASE}/sports/${sportKey}/events/${eventId}/odds?${qp.toString()}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`eventOdds ${r.status}`);
  return r.json();
}

export function bestH2HQuote(eventData: any, side: "home"|"away", preferred: string[], blocked: string[]) {
  const home = (eventData.home_team||"").toLowerCase().trim();
  const away = (eventData.away_team||"").toLowerCase().trim();
  const target = side === "home" ? home : away;
  const offers: {book:string; american:number; dec:number}[] = [];
  for (const bm of (eventData.bookmakers||[])) {
    const bname = String(bm.title||"");
    const lname = bname.toLowerCase();
    if (blocked.includes(lname)) continue;
    for (const m of (bm.markets||[])) {
      if (m.key !== "h2h") continue;
      for (const out of (m.outcomes||[])) {
        const oname = String(out.name||"").toLowerCase().trim();
        if (oname === target) {
          const american = Number(out.price);
          offers.push({ book: bname, american, dec: americanToDecimal(american) });
        }
      }
    }
  }
  if (!offers.length) return null;
  const preferredSet = new Set(preferred.map(b=>b.toLowerCase()));
  const pref = offers.filter(o => preferredSet.has(o.book.toLowerCase()));
  const pool = pref.length ? pref : offers;
  pool.sort((a,b)=> b.dec - a.dec);
  return pool[0]; // {book, american, dec}
}
