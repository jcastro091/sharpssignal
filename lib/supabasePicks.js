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

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value) {
  return String(value || "").trim();
}

function parseReasons(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
  } catch {}
  return String(value)
    .split(";")
    .map(clean)
    .filter(Boolean);
}

function groupShadowRows(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = [
      clean(row.sport),
      clean(row.away_team),
      clean(row.home_team),
      clean(row.game_time).slice(0, 16),
      clean(row.market),
      clean(row.pick_side),
    ].join("|");
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return Array.from(groups.values());
}

function publicLane(row) {
  if (!row) {
    return {
      status: "watchlist",
      bet_action: "SKIP",
      reasons: ["Waiting for clean sample, CLV coverage, no-conflict status, and fresh prices."],
      data_confidence: "low",
      betting_readiness: "red",
      closed: 0,
      record: "0-0-0",
      roi: null,
      avg_clv_pct: null,
      clv_coverage: null,
      current_best_retail_book: "",
      minimum_bettable_odds: "",
      latest_result: "",
      latest_clv_pct: null,
      latest_game: "",
      latest_pick: "",
      latest_game_time: "",
    };
  }
  return {
    status: clean(row.promotion_status) || "watchlist",
    bet_action: clean(row.bet_action) || "SKIP",
    reasons: parseReasons(row.bet_action_reasons),
    data_confidence: clean(row.data_confidence),
    betting_readiness: clean(row.betting_readiness),
    closed: toNumber(row.closed),
    record: `${toNumber(row.wins)}-${toNumber(row.losses)}-${toNumber(row.pushes)}`,
    roi: nullableNumber(row.roi),
    avg_clv_pct: nullableNumber(row.avg_clv_pct),
    clv_coverage: nullableNumber(row.clv_coverage),
    current_best_retail_book: clean(row.current_best_retail_book),
    minimum_bettable_odds: clean(row.minimum_bettable_odds),
    latest_result: clean(row.latest_result),
    latest_clv_pct: nullableNumber(row.latest_clv_pct),
    latest_game: clean(row.latest_game),
    latest_pick: clean(row.latest_pick),
    latest_game_time: clean(row.latest_game_time),
  };
}

function publicMlbUnderdogProbation(rows) {
  const lanes = (rows || []).filter((row) => {
    const key = clean(row.lane_key).toLowerCase();
    return key.includes("baseball_mlb|h2h") && key.includes("underdog");
  });
  if (!lanes.length) return publicLane(null);

  const sums = lanes.reduce(
    (acc, row) => {
      const closed = toNumber(row.closed);
      acc.closed += closed;
      acc.wins += toNumber(row.wins);
      acc.losses += toNumber(row.losses);
      acc.pushes += toNumber(row.pushes);
      acc.roiWeighted += (nullableNumber(row.roi) || 0) * closed;
      acc.avgClvWeighted += (nullableNumber(row.avg_clv_pct) || 0) * closed;
      acc.clvCoverageWeighted += (nullableNumber(row.clv_coverage) || 0) * closed;
      return acc;
    },
    { closed: 0, wins: 0, losses: 0, pushes: 0, roiWeighted: 0, avgClvWeighted: 0, clvCoverageWeighted: 0 }
  );

  const liveLane = lanes.find((row) => clean(row.current_best_retail_book) || clean(row.minimum_bettable_odds));
  const latestLane = liveLane || lanes[0];
  const reasons = Array.from(new Set(lanes.flatMap((row) => parseReasons(row.bet_action_reasons))));
  const anyFrozen = lanes.some((row) => clean(row.promotion_status).toLowerCase() === "frozen" || Boolean(row.conflicted));

  return {
    status: anyFrozen ? "frozen" : clean(latestLane.promotion_status) || "watchlist",
    bet_action: lanes.some((row) => clean(row.bet_action).toUpperCase() === "BET")
      ? "BET"
      : lanes.some((row) => clean(row.bet_action).toUpperCase() === "WATCH")
        ? "WATCH"
        : "SKIP",
    reasons: reasons.length ? reasons : ["Waiting for clean sample, CLV coverage, no-conflict status, and fresh prices."],
    data_confidence: lanes.some((row) => clean(row.data_confidence).toLowerCase() === "medium") ? "medium" : clean(latestLane.data_confidence) || "low",
    betting_readiness: lanes.some((row) => clean(row.betting_readiness).toLowerCase() === "green")
      ? "green"
      : lanes.some((row) => clean(row.betting_readiness).toLowerCase() === "yellow")
        ? "yellow"
        : "red",
    closed: sums.closed,
    record: `${sums.wins}-${sums.losses}-${sums.pushes}`,
    roi: sums.closed ? sums.roiWeighted / sums.closed : null,
    avg_clv_pct: sums.closed ? sums.avgClvWeighted / sums.closed : null,
    clv_coverage: sums.closed ? sums.clvCoverageWeighted / sums.closed : null,
    current_best_retail_book: clean(liveLane?.current_best_retail_book),
    minimum_bettable_odds: clean(liveLane?.minimum_bettable_odds),
    latest_result: clean(liveLane?.latest_result || latestLane.latest_result),
    latest_clv_pct: nullableNumber(liveLane?.latest_clv_pct ?? latestLane.latest_clv_pct),
    latest_game: clean(liveLane?.latest_game || latestLane.latest_game),
    latest_pick: clean(liveLane?.latest_pick || latestLane.latest_pick),
    latest_game_time: clean(liveLane?.latest_game_time || latestLane.latest_game_time),
  };
}

async function safeSelect(label, queryFactory, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await queryFactory(controller.signal);
    if (error) return { data: [], error: `${label}: ${error.message}` };
    return { data: data || [], error: "" };
  } catch (error) {
    if (error?.name === "AbortError") return { data: [], error: `${label}: timed out after ${timeoutMs}ms` };
    return { data: [], error: `${label}: ${error?.message || String(error)}` };
  } finally {
    clearTimeout(timer);
  }
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

  const { data: shadowRows, error: shadowError } = await safeSelect("model_predictions", (signal) =>
    supabase
      .from("model_predictions")
      .select("observed_at,sport,away_team,home_team,market,pick_side,official,game_time,prediction_result,clv_pct,closing_odds_american,updated_at")
      .eq("official", false)
      .gte("observed_at", todayStart)
      .lt("observed_at", tomorrowStart)
      .order("observed_at", { ascending: false })
      .abortSignal(signal)
      .limit(1000)
  );

  const { data: laneRows, error: laneError } = await safeSelect("lane_decisions", (signal) =>
    supabase
      .from("lane_decisions")
      .select("*")
      .order("day", { ascending: false })
      .order("updated_at", { ascending: false })
      .abortSignal(signal)
      .limit(100)
  );

  const mlbLane = publicMlbUnderdogProbation(laneRows || []);

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
  const todayPicks = (todayRows || []).map(pickToPreview);
  const shadowGroups = groupShadowRows(shadowRows || []);
  const previewErrors = [shadowError, laneError].filter(Boolean);
  return {
    ok: true,
    source: "supabase",
    key: "supabase_public_preview",
    today,
    modelRunTimeISO: (todayRows && todayRows[0]?.observed_at) || null,
    statsLast7: {
      winRatePct: graded ? Number(((wins / graded) * 100).toFixed(1)) : 0,
      roiPct: staked ? Number(((profit / staked) * 100).toFixed(1)) : 0,
      totalBets: graded,
    },
    todayPicks,
    counts: {
      todayPicks: todayPicks.length,
      todayDateTimeRows: todayPicks.length + (shadowRows || []).length,
      officialPicksToday: todayPicks.length,
      shadowRowsToday: (shadowRows || []).length,
      shadowGroupsToday: shadowGroups.length,
      laneDecisions: (laneRows || []).length,
    },
    status: {
      betting_readiness: mlbLane.bet_action,
      official_pick_status: todayPicks.length ? "official_picks_available" : "no_official_pick",
      research_status: shadowGroups.length ? "shadow_research_active" : "waiting_for_candidates",
    },
    researchSummary: {
      officialPicksToday: todayPicks.length,
      shadowCandidatesToday: shadowGroups.length,
      message: todayPicks.length
        ? "Official paid picks were present today."
        : "No official pick is public right now; watchlist research remains excluded from paid ROI.",
    },
    mlbH2hUnderdogProbation: mlbLane,
    errors: previewErrors,
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
