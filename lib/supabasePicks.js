import { DateTime } from "luxon";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "./supabaseServer";

const DEFAULT_TZ = "America/New_York";

function americanPnl(odds, stake, result) {
  if (result === "push") return 0;
  if (result === "loss") return -stake;
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

function pickToPreview(row) {
  return {
    matchup: `${row.away_team || ""} @ ${row.home_team || ""}`.trim(),
    sport: row.sport || "",
    market: row.market || "",
    pick: row.pick_side || "",
    tier: row.tier_code || row.tier_label || "",
    minutesToStart: null,
    timestampRaw: row.observed_at || "",
    timestampISO: row.observed_at || null,
    americanOdds: row.odds_american == null ? null : Number(row.odds_american),
  };
}

export async function loadPicksPreviewFromSupabase({ timezone = DEFAULT_TZ } = {}) {
  if (!hasSupabaseServiceConfig()) return null;

  const supabase = createSupabaseServiceClient();
  const now = DateTime.now().setZone(timezone);
  const today = now.toISODate();
  const todayStart = now.startOf("day").toUTC().toISO();
  const tomorrowStart = now.plus({ days: 1 }).startOf("day").toUTC().toISO();
  const start7 = now.minus({ days: 7 }).startOf("day").toUTC().toISO();

  const { data: todayRows, error: todayError } = await supabase
    .from("picks")
    .select("bet_id,observed_at,sport,away_team,home_team,market,pick_side,tier_code,tier_label,odds_american,game_time")
    .gte("observed_at", todayStart)
    .lt("observed_at", tomorrowStart)
    .order("observed_at", { ascending: false })
    .limit(50);
  if (todayError) throw todayError;

  const { data: recentBets, error: recentError } = await supabase
    .from("bets")
    .select("result,odds_american,stake,pnl,observed_at")
    .gte("observed_at", start7)
    .in("result", ["win", "loss", "push"]);
  if (recentError) throw recentError;

  let wins = 0;
  let losses = 0;
  let profit = 0;
  let staked = 0;
  for (const bet of recentBets || []) {
    const result = String(bet.result || "").toLowerCase();
    if (result === "push") continue;
    if (result === "win") wins += 1;
    if (result === "loss") losses += 1;
    const stake = Number(bet.stake || 1);
    const odds = Number(bet.odds_american || 0);
    staked += stake;
    profit += Number.isFinite(Number(bet.pnl)) ? Number(bet.pnl) : americanPnl(odds, stake, result);
  }

  const graded = wins + losses;
  return {
    ok: true,
    source: "supabase",
    today,
    modelRunTimeISO: (todayRows && todayRows[0]?.observed_at) || null,
    statsLast7: {
      winRatePct: graded ? Number(((wins / graded) * 100).toFixed(1)) : 0,
      roiPct: staked ? Number(((profit / staked) * 100).toFixed(1)) : 0,
      totalBets: graded,
    },
    todayPicks: (todayRows || []).map(pickToPreview),
  };
}

export async function loadLatestObservationsMetaFromSupabase() {
  if (!hasSupabaseServiceConfig()) return null;
  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("model_predictions")
    .select("bet_id", { count: "exact", head: true });
  if (error) throw error;
  const { data: latest, error: latestError } = await supabase
    .from("model_predictions")
    .select("observed_at")
    .order("observed_at", { ascending: false })
    .limit(1);
  if (latestError) throw latestError;
  return {
    totalRows: count || 0,
    latestPickAtISO: latest?.[0]?.observed_at || null,
  };
}
