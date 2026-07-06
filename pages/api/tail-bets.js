import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const result = await submitTailBet(body);
  return res.status(result.status).json(result.body);
}

async function submitTailBet(body) {
  const row = tailBet(body);
  if (!row.bet_id && !row.pick_id) {
    return { status: 400, body: { ok: false, error: "bet_id_or_pick_id_required" } };
  }
  if (!row.sportsbook) {
    return { status: 400, body: { ok: false, error: "sportsbook_required" } };
  }
  if (row.odds_american === null && row.odds_decimal === null) {
    return { status: 400, body: { ok: false, error: "odds_required" } };
  }
  if (row.stake === null || row.stake <= 0) {
    return { status: 400, body: { ok: false, error: "positive_stake_required" } };
  }

  let tailBetsSynced = false;
  let tailBetsError = "";
  let grade = null;
  try {
    await supabaseUpsert("tail_bets", row, "tail_bet_id");
    tailBetsSynced = true;
    try {
      grade = await autoGradeTailBet(row);
    } catch (error) {
      tailBetsError = String(error.message || error);
    }
  } catch (error) {
    tailBetsError = String(error.message || error);
  }

  try {
    await recordTailEvent(body, row);
    return {
      status: tailBetsSynced ? 200 : 202,
      body: {
        ok: true,
        tail_bet_id: row.tail_bet_id,
        tail_bets_synced: tailBetsSynced,
        fallback: tailBetsSynced ? "" : "funnel_events",
        warning: tailBetsSynced ? "" : "tail_bets_unavailable",
        grade,
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        ok: false,
        error: String(error.message || error),
        tail_bets_error: tailBetsError,
      },
    };
  }
}

async function autoGradeTailBet(row) {
  const match = await findSettledPrediction(row);
  if (!match) return null;
  const result = normalizeResult(match.result);
  if (!result) return null;
  const grade = buildTailGrade(row, result, match.clv_pct);
  await supabasePatch("tail_bets", row.tail_bet_id, grade);
  return grade;
}

async function findSettledPrediction(row) {
  const filters = [];
  if (row.bet_id) filters.push(`bet_id=eq.${encodeURIComponent(row.bet_id)}`);
  if (row.pick_id) filters.push(`prediction_id=eq.${encodeURIComponent(row.pick_id)}`);
  if (!filters.length && row.away_team && row.home_team) {
    filters.push(
      `away_team=eq.${encodeURIComponent(row.away_team)}&home_team=eq.${encodeURIComponent(row.home_team)}&market=eq.${encodeURIComponent(row.market)}`
    );
  }
  for (const filter of filters) {
    const rows = await supabaseRead(`model_predictions?select=*&${filter}&order=observed_at.desc&limit=10`);
    const settled = rows.map(normalizePrediction).find((item) => normalizeResult(item.result));
    if (settled) return settled;
  }
  return null;
}

function normalizePrediction(row) {
  const raw = parseJson(row.raw_json) || parseJson(row.raw) || {};
  const read = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
      if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
    }
    return "";
  };
  return {
    result: read("prediction_result", "Prediction Result", "result", "Result"),
    clv_pct: number(read("clv_pct", "CLV %", "CLV")),
  };
}

function normalizeResult(value) {
  const result = clean(value).toLowerCase();
  if (["win", "won", "w"].includes(result)) return "win";
  if (["loss", "lost", "lose", "l"].includes(result)) return "loss";
  if (["push", "void", "refund", "p"].includes(result)) return "push";
  return "";
}

function buildTailGrade(row, result, clvPct) {
  const stake = Number(row.stake || 0);
  let pnl = 0;
  if (result === "win") {
    pnl = row.odds_american > 0 ? stake * (row.odds_american / 100) : stake * (100 / Math.abs(row.odds_american || 100));
  } else if (result === "loss") {
    pnl = -stake;
  }
  return {
    status: "closed",
    result,
    pnl: Number(pnl.toFixed(2)),
    clv_pct: Number.isFinite(clvPct) ? clvPct : null,
    graded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function tailBet(body) {
  const now = new Date().toISOString();
  const oddsAmerican = americanOdds(body.odds_taken || body.odds_american);
  const oddsDecimal = decimalOdds(body.odds_decimal, oddsAmerican);
  const placedAt = clean(body.placed_at) || now;
  const betId = clean(body.bet_id);
  const pickId = clean(body.pick_id);
  const email = clean(body.email).toLowerCase();
  return {
    tail_bet_id: clean(body.tail_bet_id) || stableId("tail", email, betId, pickId, body.sportsbook, oddsAmerican, body.stake, placedAt),
    bet_id: betId,
    pick_id: pickId,
    email,
    bettor_label: clean(body.bettor_label),
    sportsbook: clean(body.sportsbook),
    odds_american: oddsAmerican,
    odds_decimal: oddsDecimal,
    stake: money(body.stake),
    pick_side: clean(body.pick_side || body.pick),
    market: clean(body.market),
    sport: clean(body.sport),
    away_team: clean(body.away_team),
    home_team: clean(body.home_team),
    status: clean(body.status) || "open",
    notes: clean(body.notes),
    placed_at: placedAt,
    source: clean(body.source) || "member_dashboard",
    raw_json: JSON.stringify(body),
    updated_at: now,
  };
}

async function recordTailEvent(body, row) {
  try {
    await supabaseUpsert("funnel_events", funnelEvent(body, row), "event_id");
  } catch (error) {
    await supabaseInsert("funnel_events", legacyFunnelEvent(body, row));
  }
}

async function supabaseUpsert(table, row, onConflict) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }

  const response = await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    throw new Error(`supabase_${table}_failed_${response.status}: ${await response.text()}`);
  }
}

async function supabaseInsert(table, row) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    throw new Error(`supabase_${table}_legacy_failed_${response.status}: ${await response.text()}`);
  }
}

async function supabasePatch(table, id, patch) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("supabase_not_configured");
  const response = await fetch(`${url}/rest/v1/${table}?tail_bet_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`supabase_${table}_patch_failed_${response.status}: ${await response.text()}`);
}

async function supabaseRead(path) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("supabase_not_configured");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
  });
  if (!response.ok) throw new Error(`supabase_read_failed_${response.status}: ${await response.text()}`);
  return response.json();
}

function funnelEvent(body, row) {
  const now = new Date().toISOString();
  return {
    event_id: stableId("funnel", "tail_pick", row.tail_bet_id),
    event_type: "tail_pick",
    event_at: row.placed_at,
    email: row.email,
    lead_id: clean(body.lead_id),
    subscription_id: clean(body.subscription_id),
    plan: clean(body.plan),
    page_path: clean(body.page_path),
    landing_page: clean(body.landing_page),
    referrer: clean(body.referrer),
    utm_source: clean(body.utm_source),
    utm_campaign: clean(body.utm_campaign),
    utm_content: clean(body.utm_content),
    referral_code: clean(body.referral_code),
    partner_id: clean(body.partner_id),
    raw_json: JSON.stringify({ ...body, tail_bet_id: row.tail_bet_id }),
    updated_at: now,
  };
}

function legacyFunnelEvent(body, row) {
  return {
    event_name: "tail_pick",
    email: row.email,
    source: "web",
    page_path: clean(body.page_path),
    page_url: clean(body.landing_page),
    referrer: clean(body.referrer),
    utm_source: clean(body.utm_source),
    utm_campaign: clean(body.utm_campaign),
    utm_content: clean(body.utm_content),
    metadata: {
      event_type: "tail_pick",
      event_id: stableId("funnel", "tail_pick", row.tail_bet_id),
      tail_bet_id: row.tail_bet_id,
      bet_id: row.bet_id,
      pick_id: row.pick_id,
      sportsbook: row.sportsbook,
      odds_american: row.odds_american,
      odds_decimal: row.odds_decimal,
      stake: row.stake,
      pick_side: row.pick_side,
      market: row.market,
      sport: row.sport,
      away_team: row.away_team,
      home_team: row.home_team,
      notes: row.notes,
      raw: body,
    },
    created_at: row.placed_at,
  };
}

function americanOdds(value) {
  const raw = clean(value).replace("+", "");
  if (!raw) return null;
  const number = Number(raw);
  if (!Number.isFinite(number) || number === 0) return null;
  return Math.round(number);
}

function decimalOdds(value, american) {
  const raw = clean(value);
  if (raw) {
    const number = Number(raw);
    if (Number.isFinite(number) && number > 1) return Number(number.toFixed(6));
  }
  if (american === null) return null;
  if (american >= 100) return Number((1 + american / 100).toFixed(6));
  if (american < 0) return Number((1 + 100 / Math.abs(american)).toFixed(6));
  return null;
}

function money(value) {
  const number = Number(clean(value).replace("$", "").replace(",", ""));
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

function clean(value) {
  return String(value || "").trim();
}

function stableId(...parts) {
  const source = parts.map(clean).filter(Boolean).join(":");
  return `${clean(parts[0]) || "id"}_${crypto.createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

export const _private = { americanOdds, decimalOdds, money, tailBet, funnelEvent, legacyFunnelEvent, submitTailBet, buildTailGrade };
