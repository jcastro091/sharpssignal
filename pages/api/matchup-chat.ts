// pages/api/matchup-chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BASE = process.env.LOCAL_LLM_URL || "http://127.0.0.1:8099";
const ODDS_API_KEY = process.env.ODDS_API_KEY; // add to .env.local

async function resolveEventId({
  sport,
  teams,
  start_time_utc,
}: {
  sport: string;
  teams: { home: string; away: string };
  start_time_utc?: string;
}) {
  if (!ODDS_API_KEY) throw new Error("Missing ODDS_API_KEY");
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/events?regions=us&oddsFormat=american&dateFormat=iso&apiKey=${ODDS_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`OddsAPI list events failed: ${resp.status}`);
  const events = (await resp.json()) as any[];

  // naive match by team code/name; improve with alias map if needed
  const isMatch = (e: any) => {
    const H = (e.home_team || "").toLowerCase();
    const A = (e.away_team || "").toLowerCase();
    const home = teams.home.toLowerCase();
    const away = teams.away.toLowerCase();
    const rough = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, "");

    return (
      (rough(H).includes(rough(home)) && rough(A).includes(rough(away))) ||
      (rough(H).includes(rough(teams.home)) && rough(A).includes(rough(teams.away)))
    );
  };

  let candidates = events.filter(isMatch);
  if (start_time_utc && candidates.length > 1) {
    const target = new Date(start_time_utc).getTime();
    candidates = candidates.sort(
      (a, b) =>
        Math.abs(new Date(a.commence_time).getTime() - target) -
        Math.abs(new Date(b.commence_time).getTime() - target)
    );
  }
  if (!candidates.length) throw new Error("No matching event found");
  const event = candidates[0];
  return { event_id: event.id, start_time_utc: event.commence_time };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const {
      sport = "baseball_mlb",
      league = "MLB",
      teams = { home: "BOS", away: "NYY" },
      start_time_utc, // optional hint
      pro = false,
      question = "Tell me about today's matchup and who is likely to win based on line-movement consensus."
    } = req.body || {};

    // Resolve event id first
    const { event_id, start_time_utc: resolvedCommence } = await resolveEventId({
      sport,
      teams,
      start_time_utc,
    });

    // STEP A: set context (now includes the required fields)
    const ctxResp = await fetch(`${BASE}/context/text`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sport, league, teams, pro,
        event_id,
        start_time_utc: resolvedCommence || start_time_utc
      }),
    });
    if (!ctxResp.ok) {
      const detail = await ctxResp.text();
      return res.status(502).json({ error: "context_error", detail });
    }

    // STEP B: ask the question
    const chatResp = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: question }),
    });
    if (!chatResp.ok) {
      const detail = await chatResp.text();
      return res.status(502).json({ error: "chat_error", detail });
    }
    const data = await chatResp.json();
    return res.status(200).json({ ok: true, text: data?.text ?? data });
  } catch (err: any) {
    return res.status(500).json({ error: "server_error", detail: err?.message || String(err) });
  }
}
