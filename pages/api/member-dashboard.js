import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../../lib/supabaseServer";
import { AFFILIATE_DISCLOSURE, SPORTSBOOK_OFFERS, sportsbookOfferUrl } from "../../lib/sportsbookOffers";

const ET_TZ = "America/New_York";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!hasSupabaseServiceConfig()) {
    return res.status(200).json(emptyPayload("supabase_not_configured"));
  }

  try {
    const supabase = createSupabaseServiceClient();
    const todayStart = easternDayStartIso();
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

    const [todayResult, recentResult, tailsResult] = await Promise.all([
      supabase
        .from("model_predictions")
        .select("*")
        .gte("observed_at", todayStart)
        .order("observed_at", { ascending: false })
        .limit(75),
      supabase
        .from("model_predictions")
        .select("*")
        .gte("observed_at", since)
        .order("observed_at", { ascending: false })
        .limit(750),
      supabase
        .from("tail_bets")
        .select("*")
        .order("placed_at", { ascending: false })
        .limit(20),
    ]);

    const todayRows = normalizePredictionRows(todayResult.data || []).filter(isResearchOrShadow);
    const recentRows = normalizePredictionRows(recentResult.data || []).filter(isResearchOrShadow);
    const tailRows = normalizeTailRows(tailsResult.data || []);
    const researchAlerts = groupTodayResearch(todayRows);

    return res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      today_research_alerts: researchAlerts,
      best_available_books: bestAvailableBooks(researchAlerts),
      tail_results: tailRows,
      watchlist_lanes: watchlistLanes(recentRows),
      official_pick_gate: {
        status: "watchlist_only",
        message: "Official paid-pick promotion is blocked until a lane clears sample, ROI, win-rate, and CLV gates.",
      },
      affiliate: {
        disclosure: AFFILIATE_DISCLOSURE,
        offers: SPORTSBOOK_OFFERS.map((offer) => ({ ...offer, url: sportsbookOfferUrl(offer.name) })),
      },
    });
  } catch (error) {
    return res.status(200).json(emptyPayload(error?.message || "member_dashboard_failed"));
  }
}

function emptyPayload(error) {
  return {
    ok: false,
    error,
    today_research_alerts: [],
    best_available_books: [],
    tail_results: [],
    watchlist_lanes: [],
    official_pick_gate: {
      status: "watchlist_only",
      message: "Official paid-pick promotion is blocked until a lane clears sample, ROI, win-rate, and CLV gates.",
    },
    affiliate: { disclosure: AFFILIATE_DISCLOSURE, offers: [] },
  };
}

function easternDayStartIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${byType.year}-${byType.month}-${byType.day}T00:00:00-04:00`).toISOString();
}

function normalizePredictionRows(rows) {
  return rows.map((row) => {
    const raw = parseJson(row.raw_json) || parseJson(row.raw) || {};
    const merged = { ...row, raw };
    const read = (...keys) => {
      for (const key of keys) {
        if (merged[key] !== undefined && merged[key] !== null && merged[key] !== "") return merged[key];
        if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
      }
      return "";
    };
    return {
      id: read("bet_id", "Bet ID", "prediction_id", "id"),
      bet_id: read("bet_id", "Bet ID"),
      observed_at: read("observed_at", "Timestamp", "created_at"),
      game_time: read("game_time", "Game Time", "commence_time", "Commence Time"),
      sport: read("sport", "Sport"),
      away_team: read("away_team", "Away", "Away Team"),
      home_team: read("home_team", "Home", "Home Team"),
      market: read("market", "Market"),
      pick_side: read("pick_side", "Predicted", "Recommended Side", "Direction"),
      tier_code: read("tier_code", "Tier Code"),
      official: String(read("official", "Official") || "0") === "1",
      shadow: String(read("shadow", "Shadow") || raw.Shadow || "0") === "1",
      result: read("prediction_result", "Prediction Result", "result", "Result"),
      pnl: number(read("pnl", "P&L", "Profit")),
      stake: number(read("stake", "Stake")) || 1,
      odds_american: number(read("odds_american", "Odds (Am)", "American Odds")),
      clv_pct: number(read("clv_pct", "CLV %", "CLV")),
      best_available_price: read("Best Available Price", "best_available_price"),
      recommended_book: read("Recommended Book", "recommended_book"),
      minimum_acceptable_price: read("Minimum Acceptable Price", "Minimum Acceptable Odds (Am)", "minimum_acceptable_price"),
      do_not_bet_below: read("Do Not Bet Below", "do_not_bet_below"),
      line_shop_prices: read("Line Shop Prices", "line_shop_prices"),
      signal_lane: read("Signal Lane", "signal_lane", "Setup", "setup") || "watchlist",
      retail_gap: number(read("Retail Edge vs Sharp", "retail_gap", "edge", "Edge")),
      persistence_polls: number(read("Retail Gap Persistence Polls", "persistence_polls")),
    };
  });
}

function isResearchOrShadow(row) {
  return row.shadow || ["research", "pass", "pass_tier", "near_miss"].includes(String(row.tier_code || "").toLowerCase()) || !row.official;
}

function groupTodayResearch(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const key = [row.sport, row.away_team, row.home_team, row.game_time, row.market, row.pick_side].join("|");
    const existing = buckets.get(key) || { ...row, appearances: 0, rows: [] };
    existing.appearances += Math.max(1, Number(row.persistence_polls || 0));
    existing.rows.push(row);
    if (!existing.best_available_price && row.best_available_price) existing.best_available_price = row.best_available_price;
    buckets.set(key, existing);
  }
  return Array.from(buckets.values()).slice(0, 20).map((row) => ({
    ...row,
    cta_url: sportsbookOfferUrl(row.recommended_book || parseBestBook(row.best_available_price)),
  }));
}

function bestAvailableBooks(alerts) {
  return alerts
    .filter((row) => row.best_available_price || row.recommended_book)
    .slice(0, 10)
    .map((row) => {
      const book = row.recommended_book || parseBestBook(row.best_available_price);
      return {
        game: `${row.away_team || "Away"} @ ${row.home_team || "Home"}`,
        market: row.market,
        pick_side: row.pick_side,
        best_available_price: row.best_available_price,
        book,
        minimum_acceptable_price: row.minimum_acceptable_price,
        do_not_bet_below: row.do_not_bet_below,
        cta_url: sportsbookOfferUrl(book),
      };
    });
}

function watchlistLanes(rows) {
  const buckets = new Map();
  const conflictedKeys = conflictedLaneKeys(rows);
  for (const row of rows) {
    const direction = Number(row.odds_american || 0) > 0 ? "underdog" : Number(row.odds_american || 0) < 0 ? "favorite" : "unknown";
    const key = [row.sport || "unknown", row.market || "unknown", row.signal_lane || "watchlist", direction].join("|");
    const bucket = buckets.get(key) || {
      sport: row.sport || "unknown",
      market: row.market || "unknown",
      signal_lane: row.signal_lane || "watchlist",
      direction,
      shadow_count: 0,
      official_count: 0,
      closed: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      pnl: 0,
      stake: 0,
      clv_values: [],
      conflicted: conflictedKeys.has(key),
    };
    bucket.shadow_count += row.official ? 0 : 1;
    bucket.official_count += row.official ? 1 : 0;
    const result = String(row.result || "").toLowerCase();
    if (["win", "won", "loss", "lost", "push"].includes(result)) bucket.closed += 1;
    if (["win", "won"].includes(result)) bucket.wins += 1;
    if (["loss", "lost"].includes(result)) bucket.losses += 1;
    if (result === "push") bucket.pushes += 1;
    bucket.pnl += Number(row.pnl || 0);
    bucket.stake += Number(row.stake || 0);
    if (Number.isFinite(row.clv_pct)) bucket.clv_values.push(row.clv_pct);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values())
    .map((bucket) => {
      const avgClv = bucket.clv_values.length ? bucket.clv_values.reduce((a, b) => a + b, 0) / bucket.clv_values.length : null;
      const clvCoverage = bucket.closed ? bucket.clv_values.length / bucket.closed : null;
      const roi = bucket.stake ? bucket.pnl / bucket.stake : null;
      const dataConfidence = dataConfidenceLabel(bucket.closed, clvCoverage);
      const readiness = readinessLabel({
        closed: bucket.closed,
        roi,
        avgClv,
        clvCoverage,
        winRate: bucket.closed ? bucket.wins / bucket.closed : null,
        conflicted: bucket.conflicted,
      });
      return {
        ...bucket,
        win_rate: bucket.closed ? bucket.wins / bucket.closed : null,
        roi,
        avg_clv_pct: avgClv,
        clv_coverage: clvCoverage,
        promotion_status: bucket.conflicted ? "frozen" : "watchlist_only",
        frozen: bucket.conflicted,
        freeze_reason: bucket.conflicted ? "same-game opposite-side conflict detected" : "",
        data_confidence: dataConfidence,
        betting_readiness: readiness,
        gate_reason: bucket.conflicted ? "conflict_freeze" : bucket.closed < 30 ? "needs_30_closed_shadow_results" : avgClv == null ? "needs_clv_coverage" : "awaiting_manual_promotion_review",
      };
    })
    .sort((a, b) => b.shadow_count + b.official_count - (a.shadow_count + a.official_count))
    .slice(0, 12);
}

function conflictedLaneKeys(rows) {
  const byGame = new Map();
  for (const row of rows) {
    const gameKey = [row.sport, row.away_team, row.home_team, row.game_time].map((part) => String(part || "").trim().toLowerCase()).join("|");
    const item = {
      pick: String(row.pick_side || "").trim().toLowerCase(),
      direction: Number(row.odds_american || 0) > 0 ? "underdog" : Number(row.odds_american || 0) < 0 ? "favorite" : "unknown",
      laneKey: [row.sport || "unknown", row.market || "unknown", row.signal_lane || "watchlist", Number(row.odds_american || 0) > 0 ? "underdog" : Number(row.odds_american || 0) < 0 ? "favorite" : "unknown"].join("|"),
    };
    if (!item.pick) continue;
    const list = byGame.get(gameKey) || [];
    list.push(item);
    byGame.set(gameKey, list);
  }
  const conflicted = new Set();
  for (const list of byGame.values()) {
    if (new Set(list.map((item) => item.pick)).size <= 1) continue;
    for (const item of list) conflicted.add(item.laneKey);
  }
  return conflicted;
}

function dataConfidenceLabel(closed, clvCoverage) {
  if (closed >= 50 && clvCoverage >= 0.95) return "high";
  if (closed >= 15 && clvCoverage >= 0.8) return "medium";
  return "low";
}

function readinessLabel({ closed, roi, avgClv, clvCoverage, winRate, conflicted }) {
  if (conflicted) return "red";
  if (closed >= 50 && roi > 0 && avgClv >= 0 && clvCoverage >= 0.95 && winRate >= 0.53) return "green";
  if (closed >= 15 && roi > 0 && avgClv >= 0 && clvCoverage >= 0.8) return "yellow";
  return "red";
}

function normalizeTailRows(rows) {
  return rows.map((row) => ({
    tail_bet_id: row.tail_bet_id,
    placed_at: row.placed_at,
    sportsbook: row.sportsbook,
    odds_american: row.odds_american,
    stake: row.stake,
    status: row.status,
    result: row.result,
    pnl: row.pnl,
    clv_pct: row.clv_pct,
    away_team: row.away_team,
    home_team: row.home_team,
    market: row.market,
    pick_side: row.pick_side,
  }));
}

function parseBestBook(value) {
  const match = String(value || "").match(/^([A-Za-z][A-Za-z0-9 .'-]+?)\s+[+-]?\d/);
  return match ? match[1].trim() : "";
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
