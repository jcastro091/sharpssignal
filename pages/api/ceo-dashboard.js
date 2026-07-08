import { getCeoAccess } from "../../lib/ceoAccess";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../../lib/supabaseServer";
import { loadPicksPreviewFromSupabase } from "../../lib/supabasePicks";

const REQUIRED_COLUMNS = {
  subscriptions: ["utm_content"],
  funnel_events: ["event_id", "event_type", "landing_page", "partner_id", "plan", "referral_code"],
  lane_decisions: [
    "current_best_retail_book",
    "latest_clv_pct",
    "latest_game",
    "latest_game_time",
    "latest_pick",
    "latest_result",
    "minimum_bettable_odds",
  ],
};

const EVENT_TYPES = [
  "signup_view",
  "signup_submit",
  "lead_created",
  "plan_view",
  "checkout_click",
  "subscribe_success",
  "tail_pick",
  "tail_interest",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const access = await getCeoAccess(req, res);
  if (!access.email) return res.status(401).json({ ok: false, error: "auth_required" });
  if (!access.allowed) return res.status(403).json({ ok: false, error: "forbidden" });
  if (!hasSupabaseServiceConfig()) return res.status(200).json(emptyPayload("supabase_not_configured", access));

  const supabase = createSupabaseServiceClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [schema, preview, funnel, signups, subscriptions, tailBets, apiUsage, pipelineRuns] = await Promise.all([
    schemaHealth(supabase),
    loadPreview(),
    readRows(supabase, "funnel_events", "*", { sinceColumn: "created_at", since: since30, order: "created_at", limit: 1000 }),
    readRows(supabase, "email_signups", "*", { sinceColumn: "created_at", since: since30, order: "created_at", limit: 1000 }),
    readRows(supabase, "subscriptions", "*", { order: "created_at", limit: 1000 }),
    readRows(supabase, "tail_bets", "*", { sinceColumn: "placed_at", since: since7, order: "placed_at", limit: 500 }),
    readRows(supabase, "api_usage", "*", { order: "created_at", limit: 50 }),
    readRows(supabase, "pipeline_runs", "*", { order: "started_at", limit: 25 }),
  ]);

  const growth = summarizeGrowth({ funnel: funnel.rows, signups: signups.rows, subscriptions: subscriptions.rows });
  const tail = summarizeTailBets(tailBets.rows);
  const api = summarizeApiUsage(apiUsage.rows);
  const runner = summarizeRunner(pipelineRuns.rows);
  const mlb = preview.body?.mlbH2hUnderdogProbation || {};
  const bottleneck = nextBottleneck({ schema, mlb, growth, tail, api });
  const action = bettingAction({ schema, mlb, runner });

  return res.status(200).json({
    ok: true,
    generated_at: new Date().toISOString(),
    access: {
      email: access.email,
      owner_allowlist_configured: access.allowlistConfigured,
      setup_warning: access.allowlistConfigured ? "" : "CEO_DASHBOARD_EMAILS is not configured; any authenticated user can access this page.",
    },
    betting: {
      action,
      lane_closest: "MLB H2H underdogs",
      explanation: actionExplanation(action, { schema, mlb, runner }),
      mlb_h2h_underdogs: mlb,
      preview_counts: preview.body?.counts || {},
      preview_status: preview.body?.status || {},
    },
    growth,
    tail_bets: tail,
    api_usage: api,
    runner,
    schema,
    source_health: {
      picks_preview: preview.ok ? "ready" : preview.error || "blocked",
      funnel_events: funnel.ok ? "ready" : funnel.error || "blocked",
      subscriptions: subscriptions.ok ? "ready" : subscriptions.error || "blocked",
      tail_bets: tailBets.ok ? "ready" : tailBets.error || "blocked",
      api_usage: apiUsage.ok ? "ready" : apiUsage.error || "blocked",
    },
    next_bottleneck: bottleneck,
    next_actions: nextActions({ schema, mlb, growth, tail, api }),
  });
}

function emptyPayload(error, access) {
  return {
    ok: false,
    error,
    generated_at: new Date().toISOString(),
    access: { email: access.email, owner_allowlist_configured: access.allowlistConfigured },
    betting: { action: "SKIP", lane_closest: "MLB H2H underdogs", explanation: "Supabase is unavailable." },
    growth: {},
    tail_bets: {},
    api_usage: {},
    runner: {},
    schema: { status: "blocked", missing: [] },
    source_health: {},
    next_bottleneck: error,
    next_actions: [],
  };
}

async function loadPreview() {
  try {
    const body = await loadPicksPreviewFromSupabase({ timezone: "America/New_York" });
    return { ok: true, body: body || {} };
  } catch (error) {
    return { ok: false, error: error?.message || String(error), body: {} };
  }
}

async function schemaHealth(supabase) {
  const missing = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    for (const column of columns) {
      const { error } = await supabase.from(table).select(column, { head: true, count: "exact" }).limit(1);
      if (error) missing.push({ table, column, error: error.message });
    }
  }
  return {
    status: missing.length ? "blocked" : "ready",
    missing_count: missing.length,
    missing,
    required_columns: REQUIRED_COLUMNS,
  };
}

async function readRows(supabase, table, select, { sinceColumn = "", since = "", order = "", limit = 100 } = {}) {
  try {
    let query = supabase.from(table).select(select);
    if (sinceColumn && since) query = query.gte(sinceColumn, since);
    if (order) query = query.order(order, { ascending: false });
    query = query.limit(limit);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, rows: [] };
    return { ok: true, rows: data || [] };
  } catch (error) {
    return { ok: false, error: error?.message || String(error), rows: [] };
  }
}

function summarizeGrowth({ funnel = [], signups = [], subscriptions = [] }) {
  const events = Object.fromEntries(EVENT_TYPES.map((type) => [type, 0]));
  const sources = {};
  for (const row of funnel || []) {
    const type = clean(row.event_type || row.event_name);
    if (type in events) events[type] += 1;
    const source = clean(row.utm_source || row.source || row.referrer || "unknown");
    if (!sources[source]) sources[source] = { source, events: 0, checkout_clicks: 0, subscribe_success: 0 };
    sources[source].events += 1;
    if (type === "checkout_click") sources[source].checkout_clicks += 1;
    if (type === "subscribe_success") sources[source].subscribe_success += 1;
  }
  const activePaid = (subscriptions || []).filter((row) => ["active", "trialing"].includes(clean(row.status).toLowerCase())).length;
  const signupViews = events.signup_view || 0;
  const planViews = events.plan_view || 0;
  const checkoutClicks = events.checkout_click || 0;
  const signupsCount = Math.max(events.lead_created || 0, (signups || []).length);
  return {
    window: "last_30_days",
    page_signup_views: signupViews,
    signup_submits: events.signup_submit || 0,
    leads: signupsCount,
    plan_views: planViews,
    checkout_clicks: checkoutClicks,
    subscribe_success: events.subscribe_success || 0,
    active_paid: activePaid,
    signup_to_checkout_rate: signupViews ? checkoutClicks / signupViews : null,
    plan_to_checkout_rate: planViews ? checkoutClicks / planViews : null,
    checkout_to_paid_rate: checkoutClicks ? activePaid / checkoutClicks : null,
    source_rows: Object.values(sources).sort((a, b) => b.events - a.events).slice(0, 8),
  };
}

function summarizeTailBets(rows = []) {
  const closed = rows.filter((row) => ["win", "loss", "push"].includes(clean(row.result || row.status).toLowerCase()));
  const wins = closed.filter((row) => clean(row.result || row.status).toLowerCase() === "win").length;
  const losses = closed.filter((row) => clean(row.result || row.status).toLowerCase() === "loss").length;
  const pushes = closed.filter((row) => clean(row.result || row.status).toLowerCase() === "push").length;
  const stake = rows.reduce((sum, row) => sum + number(row.stake), 0);
  const pnl = closed.reduce((sum, row) => sum + number(row.pnl), 0);
  const clvRows = closed.map((row) => number(row.clv_pct)).filter(Number.isFinite);
  return {
    window: "last_7_days",
    count: rows.length,
    open: rows.length - closed.length,
    closed: closed.length,
    record: `${wins}-${losses}-${pushes}`,
    stake,
    pnl,
    roi: stake ? pnl / stake : null,
    avg_clv_pct: clvRows.length ? clvRows.reduce((a, b) => a + b, 0) / clvRows.length : null,
  };
}

function summarizeApiUsage(rows = []) {
  const latest = rows?.[0] || {};
  const used = number(latest.used || latest.credits_used || latest.primary_used);
  const cap = number(latest.cap || latest.credit_cap || latest.primary_cap || 20000);
  return {
    status: cap && used / cap > 0.85 ? "risk" : "ok",
    used,
    cap,
    remaining: cap ? Math.max(cap - used, 0) : null,
    pct_used: cap ? used / cap : null,
    observed_at: latest.created_at || latest.observed_at || latest.updated_at || "",
  };
}

function summarizeRunner(rows = []) {
  const latest = rows?.[0] || {};
  return {
    latest_status: clean(latest.status || latest.result || "unknown"),
    latest_started_at: latest.started_at || latest.created_at || "",
    cycles_seen: rows.length,
  };
}

function bettingAction({ schema, mlb, runner }) {
  if (schema.status !== "ready") return "SKIP";
  const laneAction = clean(mlb.bet_action || mlb.action || "SKIP").toUpperCase();
  if (laneAction === "BET") return "BET";
  if (laneAction === "WATCH") return "WATCH";
  if (clean(runner.latest_status).toLowerCase().includes("fail")) return "SKIP";
  return "SKIP";
}

function actionExplanation(action, { schema, mlb, runner }) {
  if (schema.status !== "ready") return `SKIP because production schema is missing ${schema.missing_count} required column(s).`;
  if (action === "BET") return "BET only if the current book price is still inside the minimum bettable window.";
  if (action === "WATCH") return "WATCH because the lane is interesting but still below one or more hard gates.";
  if (clean(runner.latest_status).toLowerCase().includes("fail")) return "SKIP because the latest runner status is failing.";
  return clean(mlb.status || mlb.bet_action) ? `SKIP because MLB H2H underdogs is ${mlb.status || mlb.bet_action}.` : "SKIP because no lane clears the rulebook.";
}

function nextBottleneck({ schema, mlb, growth, tail, api }) {
  if (schema.status !== "ready") return "Production Supabase schema is blocking attribution and bettable-window persistence.";
  if (!clean(mlb.current_best_retail_book) || !clean(mlb.minimum_bettable_odds)) return "MLB lane needs current best retail book and minimum bettable odds on fresh candidates.";
  if ((growth.checkout_clicks || 0) < 3) return "Checkout intent is still too thin; keep tightening signup-to-checkout handoff.";
  if ((tail.closed || 0) < 10) return "Personal tail sample is still too small to infer betting behavior.";
  if (api.status === "risk") return "Odds API usage is getting hot; reduce polling waste before scaling.";
  return "Keep collecting clean MLB H2H underdog closes and attribution data.";
}

function nextActions({ schema, mlb, growth, tail, api }) {
  const actions = [];
  if (schema.status !== "ready") actions.push("Apply the CEO dashboard Supabase SQL bundle so attribution and lane bettable-window fields persist.");
  if (!clean(mlb.current_best_retail_book)) actions.push("Confirm the live runner writes current_best_retail_book for MLB H2H underdog candidates.");
  if (!clean(mlb.minimum_bettable_odds)) actions.push("Confirm the live runner writes minimum_bettable_odds before sending bettable-window alerts.");
  if ((growth.checkout_clicks || 0) < 3) actions.push("Run a tagged founder-beta test link and verify signup, plan_view, checkout_click, and Stripe metadata join.");
  if ((tail.closed || 0) < 10) actions.push("Keep logging personal tails from Telegram so the ledger reaches a usable sample.");
  if (api.status === "risk") actions.push("Review Odds API polling cadence before adding sports or books.");
  return actions;
}

function clean(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
