import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../../lib/supabaseServer";
import { AFFILIATE_DISCLOSURE, SPORTSBOOK_OFFERS, sportsbookOfferUrl } from "../../lib/sportsbookOffers";
import { getServerUser } from "../../lib/authServer";

const ET_TZ = "America/New_York";
const BETTING_RULEBOOK = {
  version: "personal_betting_readiness_v1",
  minimum_closed_sample: 50,
  minimum_clv_coverage: 0.95,
  minimum_avg_clv: 0,
  minimum_win_rate: 0.53,
  minimum_roi: 0,
  minimum_retail_gap_persistence_polls: 2,
  max_data_freshness_hours: 2,
  conflicts_allowed: false,
  bet_action_labels: {
    BET: "Lane clears hard gates. Bet only if the current price is still within the bettable window.",
    WATCH: "Interesting, but sample, persistence, or freshness is not strong enough for a personal bet.",
    SKIP: "Do not bet. Conflict, stale data, bad CLV, poor ROI, or missing audit data blocks it.",
  },
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!hasSupabaseServiceConfig()) {
    return res.status(200).json(emptyPayload("supabase_not_configured"));
  }

  try {
    const user = await getServerUser(req, res);
    const userEmail = String(user?.email || "").toLowerCase();
    const supabase = createSupabaseServiceClient();
    const todayStart = easternDayStartIso();
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

    const tailsQuery = supabase.from("tail_bets").select("*").order("placed_at", { ascending: false }).limit(20);
    if (userEmail) tailsQuery.eq("email", userEmail);

    const [todayResult, recentResult, tailsResult, pipelineResult, laneDecisionResult] = await Promise.all([
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
      userEmail ? tailsQuery : Promise.resolve({ data: [] }),
      supabase.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("lane_decisions").select("*").order("day", { ascending: false }).limit(120),
    ]);

    const todayRows = normalizePredictionRows(todayResult.data || []).filter(isResearchOrShadow);
    const recentRows = normalizePredictionRows(recentResult.data || []).filter(isResearchOrShadow);
    const tailRows = normalizeTailRows(tailsResult.data || []);
    const researchAlerts = groupTodayResearch(todayRows);
    const laneDecisionRows = laneDecisionResult.error ? [] : normalizeLaneDecisionRows(laneDecisionResult.data || []);
    const laneDecisionContext = buildLaneDecisionContext(laneDecisionRows);
    const lanes = laneDecisionContext.latest_rows.length ? laneDecisionContext.latest_rows : watchlistLanes(recentRows);
    const manualReview = {
      mlb_h2h_underdogs: buildManualMlbReview({ todayRows, lanes }),
    };
    const operatorCard = buildOperatorCard({
      todayRows,
      recentRows,
      tailRows,
      lanes,
      pipelineRows: pipelineResult.data || [],
    });
    const dailyBettingReadiness = buildDailyBettingReadiness({
      operatorCard,
      lanes,
      laneDecisionContext,
      researchAlerts,
      tailRows,
      manualReview,
    });
    const dataTrust = buildDataTrust({ rows: recentRows, lanes });
    const laneTruth = {
      mlb_h2h_underdogs: buildMlbLaneTruth(lanes),
    };

    return res.status(200).json({
      ok: true,
      authenticated: Boolean(userEmail),
      user_email: userEmail,
      generated_at: new Date().toISOString(),
      betting_rulebook: BETTING_RULEBOOK,
      today_research_alerts: researchAlerts,
      best_available_books: bestAvailableBooks(researchAlerts),
      tail_results: tailRows,
      watchlist_lanes: lanes,
      lane_decisions: laneDecisionContext,
      alert_routing: laneDecisionContext.alert_routing,
      proof_blocks: buildProofBlocks({ researchAlerts, todayRows, recentRows, tailRows, lanes, operatorCard }),
      operator_card: operatorCard,
      daily_betting_readiness: dailyBettingReadiness,
      data_trust: dataTrust,
      lane_truth: laneTruth,
      beachhead: buildBeachhead(lanes),
      retail_gap_timing_backtest: retailGapTimingBacktest(recentRows),
      manual_review: manualReview,
      official_pick_gate: {
        status: "watchlist_only",
        message: "Official paid-pick promotion is blocked until a lane clears sample, ROI, win-rate, and CLV gates.",
      },
      affiliate: {
        disclosure: AFFILIATE_DISCLOSURE,
        offers: SPORTSBOOK_OFFERS.map((offer) => ({ ...offer, url: sportsbookOfferUrl(offer.name) })),
      },
      founding_beta: foundingBetaOffer({ dataTrust, laneTruth }),
    });
  } catch (error) {
    return res.status(200).json(emptyPayload(error?.message || "member_dashboard_failed"));
  }
}

function emptyPayload(error) {
  return {
    ok: false,
    authenticated: false,
    error,
    today_research_alerts: [],
    best_available_books: [],
    tail_results: [],
    watchlist_lanes: [],
    lane_decisions: { latest_rows: [], history: { what_changed: [] }, alert_routing: alertRoutingForLanes([]) },
    alert_routing: alertRoutingForLanes([]),
    proof_blocks: [],
    operator_card: {},
    daily_betting_readiness: emptyReadinessCard(),
    data_trust: {},
    lane_truth: { mlb_h2h_underdogs: {} },
    beachhead: {},
    betting_rulebook: BETTING_RULEBOOK,
    retail_gap_timing_backtest: {},
    manual_review: { mlb_h2h_underdogs: {} },
    official_pick_gate: {
      status: "watchlist_only",
      message: "Official paid-pick promotion is blocked until a lane clears sample, ROI, win-rate, and CLV gates.",
    },
    affiliate: { disclosure: AFFILIATE_DISCLOSURE, offers: [] },
    founding_beta: {},
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
      retail_gap: number(read("Retail Edge vs Sharp", "retail_gap", "Retail Edge vs Reference", "retail_edge_vs_reference")),
      retail_gap_first: number(read("Retail Gap First", "retail_gap_first", "Retail Edge First")),
      retail_gap_latest: number(read("Retail Gap Latest", "retail_gap_latest", "Retail Edge Latest", "Retail Edge vs Sharp")),
      retail_gap_max: number(read("Retail Gap Max", "retail_gap_max", "Retail Edge Max")),
      persistence_polls: number(read("Retail Gap Persistence Polls", "persistence_polls")),
      has_retail_gap_metadata: Boolean(
        read("Retail Edge vs Sharp", "retail_edge_vs_reference", "Retail Gap Persistence Polls", "retail_gap_persistence_polls")
      ),
    };
  });
}

function isResearchOrShadow(row) {
  return row.shadow || ["research", "pass", "pass_tier", "near_miss"].includes(String(row.tier_code || "").toLowerCase()) || !row.official;
}

function normalizeLaneDecisionRows(rows) {
  return rows.map((row) => {
    const reasons = Array.isArray(row.bet_action_reasons)
      ? row.bet_action_reasons
      : String(row.bet_action_reasons || "")
          .split(/[|,]/)
          .map((item) => item.trim())
          .filter(Boolean);
    return {
      ...row,
      lane_key: row.lane_key || [row.sport || "unknown", row.market || "unknown", row.direction || "unknown"].join("|"),
      signal_lane: row.signal_lane || "watchlist",
      bet_action: row.bet_action || "WATCH",
      bet_action_reasons: reasons,
      shadow_count: number(row.shadow_count),
      official_count: number(row.official_count),
      closed: number(row.closed),
      wins: number(row.wins),
      losses: number(row.losses),
      pushes: number(row.pushes),
      roi: number(row.roi),
      avg_clv_pct: number(row.avg_clv_pct),
      clv_coverage: number(row.clv_coverage),
      latest_age_hours: number(row.latest_age_hours),
      retail_gap_persistence_polls: number(row.retail_gap_persistence_polls),
      frozen: Boolean(row.conflicted),
      freeze_reason: row.freeze_reason || "",
      manual_review_required: Boolean(row.manual_review_required),
    };
  });
}

function buildLaneDecisionContext(rows) {
  const latestDay = rows.map((row) => row.day).filter(Boolean).sort().pop();
  const latestRows = rows.filter((row) => row.day === latestDay);
  const priorByLane = new Map();
  rows
    .filter((row) => row.day && row.day !== latestDay)
    .sort((a, b) => String(b.day).localeCompare(String(a.day)))
    .forEach((row) => {
      if (!priorByLane.has(row.lane_key)) priorByLane.set(row.lane_key, row);
    });
  const transitions = latestRows
    .map((row) => {
      const previous = priorByLane.get(row.lane_key);
      if (!previous) {
        return {
          lane_key: row.lane_key,
          summary: `${row.lane_key}: new tracked lane; action ${row.bet_action || "WATCH"}`,
          current: row,
        };
      }
      const changed =
        previous.bet_action !== row.bet_action ||
        previous.promotion_status !== row.promotion_status ||
        previous.betting_readiness !== row.betting_readiness ||
        Boolean(previous.conflicted) !== Boolean(row.conflicted) ||
        Number(previous.closed || 0) !== Number(row.closed || 0) ||
        Number(previous.avg_clv_pct || 0) !== Number(row.avg_clv_pct || 0);
      if (!changed) return null;
      return {
        lane_key: row.lane_key,
        summary: `${row.lane_key}: action ${previous.bet_action || "-"}->${row.bet_action || "-"}; readiness ${previous.betting_readiness || "-"}->${row.betting_readiness || "-"}; closed ${Number(row.closed || 0) - Number(previous.closed || 0)}`,
        previous,
        current: row,
      };
    })
    .filter(Boolean);
  return {
    latest_day: latestDay || null,
    latest_rows: latestRows,
    history: {
      transitions,
      what_changed: transitions.length ? transitions.slice(0, 6).map((item) => item.summary) : ["No material lane decision changes since the prior saved report."],
    },
    alert_routing: alertRoutingForLanes(latestRows),
  };
}

function alertRoutingForLanes(lanes) {
  const counts = { BET: 0, WATCH: 0, SKIP: 0 };
  for (const lane of lanes || []) {
    const action = String(lane.bet_action || "WATCH").toUpperCase();
    counts[action] = (counts[action] || 0) + 1;
  }
  return {
    policy: {
      BET: "urgent_user_alert",
      WATCH: "research_alert_operator_and_member_dashboard",
      SKIP: "operator_only_no_user_push",
    },
    counts,
  };
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

function buildProofBlocks({ researchAlerts, todayRows, recentRows, tailRows, lanes, operatorCard }) {
  const closedRecent = recentRows.filter((row) => ["win", "won", "loss", "lost", "push"].includes(String(row.result || "").toLowerCase()));
  const clvCovered = closedRecent.filter((row) => Number.isFinite(row.clv_pct)).length;
  const tailClosed = tailRows.filter((row) => ["win", "loss", "push"].includes(String(row.result || row.status || "").toLowerCase()));
  const tailPnl = tailClosed.reduce((sum, row) => sum + (Number(row.pnl) || 0), 0);
  return [
    {
      label: "Today research",
      value: `${researchAlerts.length} grouped`,
      detail: researchAlerts.length ? "Signals are being tracked before promotion." : "No watchlist alerts have appeared today.",
    },
    {
      label: "No-pick reason",
      value: friendlyReason(operatorCard.latest_no_pick_reason),
      detail: "No-pick days still explain what the runner watched and why paid alerts did not fire.",
    },
    {
      label: "CLV coverage",
      value: closedRecent.length ? `${clvCovered}/${closedRecent.length}` : "n/a",
      detail: "Closed research rows need closing-line value before we trust a lane.",
    },
    {
      label: "Your ledger",
      value: `${tailRows.length} bets`,
      detail: tailRows.length ? `Closed P&L ${moneyText(tailPnl)}.` : "Reply to Telegram alerts to build your personal tracked record.",
    },
    {
      label: "Audited lanes",
      value: `${lanes.length} lanes`,
      detail: "Each lane shows readiness, confidence, and conflict freeze status.",
    },
  ];
}

function buildOperatorCard({ todayRows, recentRows, tailRows, lanes, pipelineRows }) {
  const latestRun = pipelineRows[0] || {};
  const officialToday = todayRows.filter((row) => row.official).length;
  const watchlistToday = todayRows.filter((row) => !row.official).length;
  const conflicts = lanes.filter((lane) => lane.frozen).length;
  const closedRecent = recentRows.filter((row) => ["win", "won", "loss", "lost", "push"].includes(String(row.result || "").toLowerCase()));
  const clvGaps = closedRecent.filter((row) => !Number.isFinite(row.clv_pct)).length;
  const tailClosed = tailRows.filter((row) => ["win", "loss", "push"].includes(String(row.result || row.status || "").toLowerCase()));
  const tailPnl = tailClosed.reduce((sum, row) => sum + (Number(row.pnl) || 0), 0);
  const api = readApiUsage(latestRun);
  const topLane = lanes.find((lane) => lane.bet_action === "BET") || lanes.find((lane) => lane.bet_action === "WATCH") || lanes[0] || {};
  const hasLaneSnapshot = lanes.length > 0;
  const decision = topLane.bet_action === "BET" ? "green" : topLane.bet_action === "WATCH" || (!hasLaneSnapshot && watchlistToday > 0) ? "yellow" : "red";
  return {
    decision,
    bet_action: topLane.bet_action || (!hasLaneSnapshot && watchlistToday > 0 ? "WATCH" : "SKIP"),
    bet_action_reasons: topLane.bet_action_reasons || [],
    decision_label: decision === "green" ? "Bet candidate cleared gates" : decision === "yellow" ? "Watch only" : "Skip today",
    official_picks_today: officialToday,
    watchlist_candidates_today: watchlistToday,
    conflicts,
    clv_gaps: clvGaps,
    tail_pnl: tailPnl,
    latest_no_pick_reason: latestRun.no_alert_reason || "",
    games_watched: Number(latestRun.future_events_seen || latestRun.events_seen || 0),
    api_used: api.used,
    api_cap: api.cap,
    api_remaining: api.remaining,
    api_projected_monthly_used: api.projected,
  };
}

function buildDailyBettingReadiness({ operatorCard, lanes, laneDecisionContext, researchAlerts, tailRows, manualReview }) {
  const sortedLanes = [...(lanes || [])].sort((a, b) => actionRank(a.bet_action) - actionRank(b.bet_action));
  const topLane = sortedLanes[0] || {};
  const counts = (laneDecisionContext?.alert_routing || alertRoutingForLanes(lanes || [])).counts || {};
  const hasSavedLaneSnapshot = Boolean(laneDecisionContext?.latest_day && (lanes || []).length);
  const hasBet = Number(counts.BET || 0) > 0;
  const hasWatch = Number(counts.WATCH || 0) > 0 || (!hasSavedLaneSnapshot && Number(operatorCard.watchlist_candidates_today || 0) > 0);
  const action = hasBet ? "BET" : hasWatch ? "WATCH" : "SKIP";
  const tone = action === "BET" ? "green" : action === "WATCH" ? "yellow" : "red";
  const reasons = readinessReasons({ action, topLane, operatorCard, counts });
  const changes = laneDecisionContext?.history?.what_changed || [];
  const tailClosed = (tailRows || []).filter((row) => ["win", "loss", "push"].includes(String(row.result || row.status || "").toLowerCase()));
  const tailPnl = tailClosed.reduce((sum, row) => sum + (Number(row.pnl) || 0), 0);
  const manualMlb = manualReview?.mlb_h2h_underdogs || {};

  return {
    action,
    tone,
    label: readinessLabelForAction(action),
    plain_english: readinessPlainEnglish(action),
    reasons,
    next_step: readinessNextStep(action),
    money_stance:
      action === "BET"
        ? "A lane cleared the audit gates. Still bet only if the current sportsbook price is inside the bettable window."
        : "Do not blindly bet. Keep collecting samples, CLV, and conflict-free closes before risking money from this lane.",
    source_of_truth: laneDecisionContext?.latest_day
      ? `lane_decisions saved for ${laneDecisionContext.latest_day}`
      : "live watchlist fallback; no saved lane_decisions snapshot",
    lane_snapshot: {
      latest_day: laneDecisionContext?.latest_day || null,
      total_lanes: (lanes || []).length,
      bet: Number(counts.BET || 0),
      watch: Number(counts.WATCH || 0),
      skip: Number(counts.SKIP || 0),
      top_lane: summarizeLane(topLane),
    },
    operations: {
      official_picks_today: operatorCard.official_picks_today || 0,
      watchlist_candidates_today: operatorCard.watchlist_candidates_today || 0,
      research_alerts_today: (researchAlerts || []).length,
      conflicts: operatorCard.conflicts || 0,
      clv_gaps: operatorCard.clv_gaps || 0,
      games_watched: operatorCard.games_watched || 0,
      latest_no_pick_reason: friendlyReason(operatorCard.latest_no_pick_reason),
    },
    personal_ledger: {
      logged_bets: (tailRows || []).length,
      closed_bets: tailClosed.length,
      pnl: tailPnl,
    },
    alert_routing: {
      user_push: hasBet ? "allowed for BET lanes only" : "blocked until a lane reaches BET",
      research: Number(counts.WATCH || 0) > 0 ? "WATCH lanes stay dashboard/internal research" : "no WATCH lanes",
      quiet: `${Number(counts.SKIP || 0)} SKIP lanes stay operator-only`,
    },
    what_changed: changes.slice(0, 4),
    manual_review: {
      beachhead: "MLB H2H underdogs",
      status: manualMlb.status || "WATCHLIST_NOT_PROFITABLE_CLAIM",
      triggered: Boolean(manualMlb.did_trigger),
      persistent: Boolean(manualMlb.was_gap_persistent),
      conflict: Boolean(manualMlb.had_conflict),
    },
  };
}

function buildDataTrust({ rows, lanes }) {
  const conflictedKeys = new Set((lanes || []).filter((lane) => lane.frozen).map((lane) => lane.lane_key));
  const checks = (rows || []).map((row) => {
    const laneKey = rowLaneKey(row);
    const result = normalizedResult(row.result);
    const closed = ["win", "loss", "push"].includes(result);
    const missing = [];
    if (!row.best_available_price && !row.recommended_book) missing.push("best_book");
    if (!row.minimum_acceptable_price && !row.do_not_bet_below) missing.push("minimum_price");
    if (closed && !Number.isFinite(row.clv_pct)) missing.push("clv");
    if (closed && !result) missing.push("result");
    if (!laneKey) missing.push("lane_key");
    return {
      bet_id: row.bet_id || row.id,
      game: `${row.away_team || ""} @ ${row.home_team || ""}`.trim(),
      lane_key: laneKey,
      conflict_status: conflictedKeys.has(laneKey) ? "conflicted" : "clean",
      result_status: closed ? result : "pending",
      clv_status: Number.isFinite(row.clv_pct) ? "captured" : closed ? "missing" : "pending_capture",
      best_available_price: row.best_available_price || row.recommended_book || "",
      minimum_acceptable_price: row.minimum_acceptable_price || row.do_not_bet_below || "",
      missing,
      complete: missing.length === 0,
    };
  });
  const missingCounts = {};
  for (const row of checks) {
    for (const key of row.missing) missingCounts[key] = (missingCounts[key] || 0) + 1;
  }
  const complete = checks.filter((row) => row.complete).length;
  const blockers = [];
  if (missingCounts.best_book) blockers.push(`${missingCounts.best_book} candidate(s) missing best book`);
  if (missingCounts.minimum_price) blockers.push(`${missingCounts.minimum_price} candidate(s) missing minimum price`);
  if (missingCounts.clv) blockers.push(`${missingCounts.clv} closed candidate(s) missing CLV`);
  if (missingCounts.result) blockers.push(`${missingCounts.result} closed candidate(s) missing result`);
  if (missingCounts.lane_key) blockers.push(`${missingCounts.lane_key} candidate(s) missing lane key`);
  return {
    status: blockers.length ? "blocked" : "ready",
    total_candidates: checks.length,
    complete_candidates: complete,
    coverage: checks.length ? complete / checks.length : null,
    missing_counts: missingCounts,
    blockers,
    policy: "Open candidates use result=pending and CLV=pending_capture; closed candidates must have result and CLV.",
    examples: checks.filter((row) => row.missing.length).slice(0, 8),
  };
}

function buildMlbLaneTruth(lanes) {
  const mlb = (lanes || []).find((lane) => {
    const key = String(lane.lane_key || "").toLowerCase();
    return key.includes("baseball_mlb") && key.includes("h2h") && key.includes("underdog");
  }) || {};
  const closed = Number(mlb.closed || 0);
  const clvCoverage = Number(mlb.clv_coverage);
  const avgClv = Number(mlb.avg_clv_pct);
  const blockers = [];
  if (closed < BETTING_RULEBOOK.minimum_closed_sample) blockers.push(`${BETTING_RULEBOOK.minimum_closed_sample - closed} more clean closed group(s)`);
  if (!Number.isFinite(clvCoverage) || clvCoverage < BETTING_RULEBOOK.minimum_clv_coverage) blockers.push(`CLV coverage needs ${pctText(BETTING_RULEBOOK.minimum_clv_coverage)}; currently ${pctText(clvCoverage)}`);
  if (!Number.isFinite(avgClv) || avgClv < BETTING_RULEBOOK.minimum_avg_clv) blockers.push(`avg CLV must be non-negative; currently ${pctText(avgClv)}`);
  if (mlb.frozen) blockers.push("same-game conflicts must resolve");
  const isReal = blockers.length === 0 && Boolean(mlb.lane_key);
  return {
    label: "MLB H2H underdogs",
    source_sample: "clean_non_conflicted_groups_only",
    verdict: isReal ? "REAL_CANDIDATE_READY_FOR_BET_REVIEW" : "NOT_PROVEN_YET",
    is_real: isReal,
    closed,
    target_closed_groups: BETTING_RULEBOOK.minimum_closed_sample,
    roi: mlb.roi ?? null,
    avg_clv_pct: mlb.avg_clv_pct ?? null,
    clv_coverage: mlb.clv_coverage ?? null,
    record: `${Number(mlb.wins || 0)}-${Number(mlb.losses || 0)}-${Number(mlb.pushes || 0)}`,
    what_would_need_to_change: blockers,
  };
}

function foundingBetaOffer({ dataTrust, laneTruth }) {
  const lane = laneTruth?.mlb_h2h_underdogs || {};
  return {
    headline: "Founding beta: audited signals before picks claims",
    bullets: [
      "Transparent watchlist lanes with no-pick reasons",
      "Best available book and minimum bettable price when a window exists",
      "Personal Telegram/website tail ledger and P&L",
      "Audited CLV, conflicts, and lane-readiness gates",
      "Founding pricing while the model proves out",
    ],
    proof: {
      data_trust_status: dataTrust?.status || "unknown",
      beachhead_verdict: lane.verdict || "NOT_PROVEN_YET",
      profitable_claim: false,
    },
    cta_label: "Join founding beta",
    cta_url: "/subscribe?plan=pro_telegram&utm_source=dashboard&utm_campaign=founding_beta&utm_content=transparency_offer",
  };
}

function emptyReadinessCard() {
  return {
    action: "SKIP",
    tone: "red",
    label: "Skip today",
    plain_english: "The dashboard could not load enough audited data to approve a bet.",
    reasons: ["dashboard data unavailable"],
    next_step: "Check the operator report and lane_decisions persistence before betting.",
    lane_snapshot: { latest_day: null, total_lanes: 0, bet: 0, watch: 0, skip: 0, top_lane: {} },
  };
}

function actionRank(action) {
  const normalized = String(action || "WATCH").toUpperCase();
  if (normalized === "BET") return 0;
  if (normalized === "WATCH") return 1;
  return 2;
}

function readinessLabelForAction(action) {
  if (action === "BET") return "Bettable lane found";
  if (action === "WATCH") return "Watch only";
  return "Skip today";
}

function readinessPlainEnglish(action) {
  if (action === "BET") return "One or more lanes cleared the hard betting gates. Confirm the live price is still inside the bettable window before placing anything.";
  if (action === "WATCH") return "There is research worth monitoring, but the lane has not cleared enough sample, CLV, freshness, or conflict gates for a real-money bet.";
  return "No lane is bettable right now. The system should stay quiet for users and keep the reason visible to the operator.";
}

function readinessNextStep(action) {
  if (action === "BET") return "Check the best available sportsbook price, confirm minimum acceptable odds, then log any tail bet immediately.";
  if (action === "WATCH") return "Let the lane collect more closes and CLV, then review tomorrow's transition summary.";
  return "Do not force action. Repair data gaps, watch for conflicts, and wait for a lane to move from SKIP to WATCH or BET.";
}

function readinessReasons({ action, topLane, operatorCard, counts }) {
  const laneReasons = Array.isArray(topLane.bet_action_reasons) ? topLane.bet_action_reasons.filter(Boolean) : [];
  const reasons = [...laneReasons];
  if (operatorCard.conflicts) reasons.push(`${operatorCard.conflicts} lane conflict${operatorCard.conflicts === 1 ? "" : "s"} still block promotion`);
  if (operatorCard.clv_gaps) reasons.push(`${operatorCard.clv_gaps} closed row${operatorCard.clv_gaps === 1 ? "" : "s"} still missing CLV`);
  if (!reasons.length && action === "BET") reasons.push("all personal betting-readiness gates clear");
  if (!reasons.length && action === "WATCH") reasons.push("research is active, but no lane has cleared BET gates");
  if (!reasons.length && action === "SKIP") reasons.push(`${Number(counts.SKIP || 0)} lanes are SKIP and no WATCH/BET lane is active`);
  return reasons.slice(0, 5);
}

function summarizeLane(lane) {
  if (!lane || !lane.lane_key) return {};
  return {
    lane_key: lane.lane_key,
    sport: lane.sport,
    market: lane.market,
    direction: lane.direction,
    action: lane.bet_action || "WATCH",
    readiness: lane.betting_readiness || "red",
    confidence: lane.data_confidence || "low",
    closed: lane.closed || 0,
    roi: lane.roi ?? null,
    avg_clv_pct: lane.avg_clv_pct ?? null,
    clv_coverage: lane.clv_coverage ?? null,
    reasons: lane.bet_action_reasons || [],
  };
}

function rowLaneKey(row) {
  const direction = Number(row.odds_american || 0) > 0 ? "underdog" : Number(row.odds_american || 0) < 0 ? "favorite" : "unknown";
  return [row.sport || "unknown", row.market || "unknown", row.signal_lane || "watchlist", direction].join("|");
}

function normalizedResult(value) {
  const raw = String(value || "").toLowerCase();
  if (["win", "won", "w"].includes(raw)) return "win";
  if (["loss", "lost", "lose", "l"].includes(raw)) return "loss";
  if (["push", "void"].includes(raw)) return "push";
  return "";
}

function pctText(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-";
}

function buildBeachhead(lanes) {
  const lane = lanes.find(
    (item) =>
      String(item.sport || "").toLowerCase() === "baseball_mlb" &&
      String(item.market || "").toLowerCase().startsWith("h2h") &&
      item.direction === "underdog"
  );
  if (!lane) {
    return {
      label: "MLB H2H underdogs",
      status: "watchlist_only",
      message: "No lane sample available yet. Keep collecting shadow data.",
    };
  }
  return {
    ...lane,
    label: "MLB H2H underdogs",
    status: lane.frozen ? "frozen_watchlist" : "watchlist_only",
    message: "This is the current beachhead candidate, but it is not promoted as profitable until sample, CLV, and conflict gates clear.",
  };
}

function buildManualMlbReview({ todayRows, lanes }) {
  const items = todayRows.filter(
    (row) =>
      String(row.sport || "").toLowerCase() === "baseball_mlb" &&
      String(row.market || "").toLowerCase().startsWith("h2h") &&
      Number(row.odds_american || 0) > 0
  );
  const lane = lanes.find(
    (item) =>
      String(item.sport || "").toLowerCase() === "baseball_mlb" &&
      String(item.market || "").toLowerCase().startsWith("h2h") &&
      item.direction === "underdog"
  );
  const closed = items.filter((row) => ["win", "won", "loss", "lost", "push"].includes(String(row.result || "").toLowerCase()));
  const clvs = closed.map((row) => row.clv_pct).filter(Number.isFinite);
  const persistent = items.filter((row) => Number(row.persistence_polls || 0) >= BETTING_RULEBOOK.minimum_retail_gap_persistence_polls);
  return {
    label: "MLB H2H underdogs",
    status: "WATCHLIST_NOT_PROFITABLE_CLAIM",
    did_trigger: items.length > 0,
    trigger_count: items.length,
    was_gap_persistent: persistent.length > 0,
    persistent_count: persistent.length,
    did_close_better: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length > 0 : false,
    avg_clv_pct: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length : null,
    record: `${closed.filter((row) => ["win", "won"].includes(String(row.result || "").toLowerCase())).length}-${closed.filter((row) => ["loss", "lost"].includes(String(row.result || "").toLowerCase())).length}-${closed.filter((row) => String(row.result || "").toLowerCase() === "push").length}`,
    had_conflict: Boolean(lane?.frozen),
    conflict_count: lane?.frozen ? 1 : 0,
    answer: items.length ? "watch" : "no_trigger",
    note: "Manual review lane only. Do not market this as profitable until hard gates clear.",
  };
}

function readApiUsage(run) {
  const raw = parseJson(run?.raw) || {};
  const primary = raw?.api_usage?.primary || {};
  return {
    used: Number(run?.primary_used || primary.used || 0),
    remaining: Number(run?.primary_remaining || primary.remaining || 0),
    cap: Number(primary.cap || (Number(run?.primary_used || 0) + Number(run?.primary_remaining || 0)) || 0),
    projected: Number(primary.projected_monthly_used || 0),
  };
}

function friendlyReason(value) {
  const labels = {
    no_model_qualified_edges: "No model-qualified edges",
    shadow_only_pass_tier: "Only pass-tier shadows",
    shadow_only_retail_gap: "Retail-gap research only",
    no_events: "No eligible events",
    "": "No runner reason",
  };
  return labels[String(value || "").trim()] || String(value || "No runner reason");
}

function moneyText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
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
      latest_observed_at: "",
      max_persistence: 0,
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
    if (!bucket.latest_observed_at || new Date(row.observed_at || 0) > new Date(bucket.latest_observed_at || 0)) {
      bucket.latest_observed_at = row.observed_at;
    }
    bucket.max_persistence = Math.max(bucket.max_persistence, Number(row.persistence_polls || 0));
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values())
    .map((bucket) => {
      const avgClv = bucket.clv_values.length ? bucket.clv_values.reduce((a, b) => a + b, 0) / bucket.clv_values.length : null;
      const clvCoverage = bucket.closed ? bucket.clv_values.length / bucket.closed : null;
      const roi = bucket.stake ? bucket.pnl / bucket.stake : null;
      const dataConfidence = dataConfidenceLabel(bucket.closed, clvCoverage);
      const latestAgeHours = ageHours(bucket.latest_observed_at);
      const betAction = betWatchSkipForLane({
        closed: bucket.closed,
        roi,
        avgClv,
        clvCoverage,
        winRate: bucket.closed ? bucket.wins / bucket.closed : null,
        conflicted: bucket.conflicted,
        latestAgeHours,
        retailPersistence: bucket.max_persistence,
      });
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
        bet_action: betAction.action,
        bet_action_reasons: betAction.reasons,
        latest_age_hours: latestAgeHours,
        retail_gap_persistence_polls: bucket.max_persistence,
        gate_reason: bucket.conflicted ? "conflict_freeze" : bucket.closed < 30 ? "needs_30_closed_shadow_results" : avgClv == null ? "needs_clv_coverage" : "awaiting_manual_promotion_review",
      };
    })
    .sort((a, b) => b.shadow_count + b.official_count - (a.shadow_count + a.official_count))
    .slice(0, 12);
}

function betWatchSkipForLane({ closed, roi, avgClv, clvCoverage, winRate, conflicted, latestAgeHours, retailPersistence }) {
  const hard = [];
  const watch = [];
  if (conflicted) hard.push("same-game opposite-side conflict");
  if (!Number.isFinite(latestAgeHours)) watch.push("no fresh timestamp available");
  else if (latestAgeHours > BETTING_RULEBOOK.max_data_freshness_hours) hard.push(`data older than ${BETTING_RULEBOOK.max_data_freshness_hours}h`);
  if (closed < BETTING_RULEBOOK.minimum_closed_sample) watch.push(`need ${BETTING_RULEBOOK.minimum_closed_sample} closed groups; have ${closed}`);
  if (!Number.isFinite(clvCoverage) || clvCoverage < BETTING_RULEBOOK.minimum_clv_coverage) hard.push(`CLV coverage below ${Math.round(BETTING_RULEBOOK.minimum_clv_coverage * 100)}%`);
  if (!Number.isFinite(avgClv) || avgClv < BETTING_RULEBOOK.minimum_avg_clv) hard.push("average CLV below 0.0%");
  if (!Number.isFinite(roi) || roi <= BETTING_RULEBOOK.minimum_roi) hard.push("flat-stake ROI is not positive");
  if (!Number.isFinite(winRate) || winRate < BETTING_RULEBOOK.minimum_win_rate) watch.push(`win rate below ${Math.round(BETTING_RULEBOOK.minimum_win_rate * 100)}%`);
  if (retailPersistence && retailPersistence < BETTING_RULEBOOK.minimum_retail_gap_persistence_polls) watch.push(`retail gap needs ${BETTING_RULEBOOK.minimum_retail_gap_persistence_polls} polls`);
  if (hard.length) return { action: "SKIP", reasons: [...hard, ...watch] };
  if (watch.length) return { action: "WATCH", reasons: watch };
  return { action: "BET", reasons: ["all personal betting-readiness gates clear"] };
}

function ageHours(value) {
  const ts = new Date(value || "");
  if (Number.isNaN(ts.getTime())) return null;
  return Math.max(0, (Date.now() - ts.getTime()) / 36e5);
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

function retailGapTimingBacktest(rows) {
  const closed = rows.filter(
    (row) =>
      ["win", "won", "loss", "lost", "push"].includes(String(row.result || "").toLowerCase()) &&
      row.has_retail_gap_metadata &&
      Number.isFinite(row.retail_gap_latest || row.retail_gap_first || row.retail_gap)
  );
  return {
    first_alert: retailGapTimingMetrics(closed, () => true, "Bet immediately when the retail gap first appears."),
    second_poll: retailGapTimingMetrics(
      closed,
      (row) => Number(row.persistence_polls || 0) >= BETTING_RULEBOOK.minimum_retail_gap_persistence_polls,
      "Wait until the gap persists for at least two polls."
    ),
    max_observed_gap: retailGapTimingMetrics(
      closed,
      (row) => Number.isFinite(row.retail_gap_max || row.retail_gap_latest || row.retail_gap),
      "Evaluate outcomes for candidates whose max observed gap was captured."
    ),
  };
}

function retailGapTimingMetrics(rows, predicate, description) {
  const selected = rows.filter(predicate);
  const wins = selected.filter((row) => ["win", "won"].includes(String(row.result || "").toLowerCase())).length;
  const losses = selected.filter((row) => ["loss", "lost"].includes(String(row.result || "").toLowerCase())).length;
  const pushes = selected.filter((row) => String(row.result || "").toLowerCase() === "push").length;
  const pnl = selected.map((row) => Number(row.pnl || 0));
  const clvs = selected.map((row) => row.clv_pct).filter(Number.isFinite);
  const gaps = selected
    .map((row) => row.retail_gap_max || row.retail_gap_latest || row.retail_gap)
    .filter(Number.isFinite);
  return {
    description,
    count: selected.length,
    wins,
    losses,
    pushes,
    win_rate: wins + losses ? wins / (wins + losses) : null,
    roi: selected.length ? pnl.reduce((a, b) => a + b, 0) / selected.length : null,
    unit_pnl: pnl.length ? pnl.reduce((a, b) => a + b, 0) : null,
    avg_clv_pct: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length : null,
    avg_max_retail_gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
  };
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
    source: row.source,
    telegram_user_id: row.telegram_user_id,
    telegram_username: row.telegram_username,
    account_link_status: row.account_link_status || "unknown",
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
