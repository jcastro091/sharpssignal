import crypto from "crypto";

const BOOK_ALIASES = [
  ["DraftKings", /\b(draft\s*kings|draftkings|dk)\b/i],
  ["FanDuel", /\b(fan\s*duel|fanduel|fd)\b/i],
  ["Caesars", /\b(caesars|caesar'?s)\b/i],
  ["BetMGM", /\b(bet\s*mgm|betmgm|mgm)\b/i],
  ["Fanatics", /\b(fanatics)\b/i],
  ["ESPN BET", /\b(espn\s*bet|espnbet)\b/i],
  ["bet365", /\b(bet365|365)\b/i],
  ["Hard Rock Bet", /\b(hard\s*rock)\b/i],
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const update = typeof req.body === "object" && req.body ? req.body : {};
  if (update.message_reaction || update.message_reaction_count) {
    return res.status(200).json({ ok: true, action: "soft_interest", tracked_bet: false });
  }
  const link = await parseTelegramAccountLink(update);
  if (link.ok) {
    await replyToTelegram(update, link.message);
    return res.status(200).json(link);
  }
  const callback = parseTelegramCallback(update);
  if (callback.ok && callback.action === "custom") {
    await answerCallback(update, "Reply with your stake, book, and odds.");
    await replyToTelegram(update, "Reply to the alert with your actual bet, like: DraftKings +107 $20");
    return res.status(200).json(callback);
  }
  if (callback.ok && callback.action === "skip") {
    await answerCallback(update, "Marked as skipped.");
    await replyToTelegram(update, "Skipped. No bet was added to your ledger.");
    return res.status(200).json(callback);
  }
  if (callback.ok && callback.action === "tail") {
    const tail = await resolveTailIdentity(callback.tail);
    const result = await submitTailBet(tail);
    const text = confirmationText(result.body, tail);
    await answerCallback(update, result.body.ok ? "Tail logged." : "Could not log tail.");
    await replyToTelegram(update, text);
    return res.status(200).json({ ok: result.body.ok, tail, capture: result.body });
  }

  const parsed = parseTelegramTail(update);
  if (!parsed.ok) {
    await replyToTelegram(update, helpText(parsed.error));
    return res.status(200).json(parsed);
  }

  const tail = await resolveTailIdentity(parsed.tail);
  const result = await submitTailBet(tail);
  await replyToTelegram(update, confirmationText(result.body, tail));
  return res.status(200).json({ ok: result.body.ok, tail, capture: result.body });
}

function authorized(req) {
  const expected = clean(process.env.TELEGRAM_TAIL_WEBHOOK_SECRET);
  if (!expected) return true;
  const querySecret = clean((req.query || {}).secret);
  const headerSecret = clean((req.headers || {})["x-telegram-bot-api-secret-token"]);
  return querySecret === expected || headerSecret === expected;
}

function parseTelegramTail(update) {
  const message = telegramMessage(update);
  const text = clean(message.text || message.caption);
  const replyText = clean((message.reply_to_message || {}).text || (message.reply_to_message || {}).caption);
  const sourceText = `${text}\n${replyText}`.trim();
  const bestRetail = extractBestRetail(replyText);
  const alert = extractAlertContext(replyText);
  const inferredId = stableId("telegram_pick", alert.away_team, alert.home_team, alert.market, alert.pick_side, alert.game_time);
  const betId = extractBetId(sourceText);
  const sportsbook = extractSportsbook(text) || bestRetail.sportsbook || extractSportsbook(replyText);
  const odds = extractAmericanOdds(text) || bestRetail.odds || extractAmericanOdds(replyText);
  const stake = extractStake(text) || "1";
  const identity = telegramIdentity(update);

  if (!text) return { ok: false, error: "empty_message" };
  if (!betId && !alert.has_context) return { ok: false, error: "missing_bet_id" };
  if (!sportsbook) return { ok: false, error: "missing_sportsbook" };
  if (!odds) return { ok: false, error: "missing_odds" };
  const textPick = extractPickSide(text);
  const alertPick = alert.pick_side || extractAlertPick(replyText);

  return {
    ok: true,
    tail: {
      bet_id: betId,
      pick_id: betId ? "" : inferredId,
      email: "",
      sportsbook,
      odds_taken: odds,
      stake,
      pick_side: isGenericTailPick(textPick) ? alertPick : textPick || alertPick,
      market: alert.market,
      sport: alert.sport,
      away_team: alert.away_team,
      home_team: alert.home_team,
      placed_at: new Date().toISOString(),
      source: "telegram_reply",
      notes: tailNote(text, stake, bestRetail, alert, betId),
      raw_telegram_update_id: identity.update_id,
      telegram_chat_id: identity.chat_id,
      telegram_user_id: identity.user_id,
      telegram_username: identity.username,
    },
  };
}

function telegramMessage(update) {
  return update.message || update.edited_message || update.channel_post || update.edited_channel_post || {};
}

function telegramCallback(update) {
  return update.callback_query || {};
}

function parseTelegramCallback(update) {
  const callback = telegramCallback(update);
  const data = clean(callback.data);
  if (!data) return { ok: false, error: "missing_callback_data" };
  const [prefix, value] = data.split(":");
  if (prefix !== "tail") return { ok: false, error: "unsupported_callback" };
  if (value === "custom") return { ok: true, action: "custom" };
  if (value === "skip") return { ok: true, action: "skip" };
  const stake = moneyAmount(value);
  if (!stake || stake <= 0) return { ok: false, error: "invalid_callback_stake" };

  const message = callback.message || {};
  const replyText = clean(message.text || message.caption);
  const bestRetail = extractBestRetail(replyText);
  const alert = extractAlertContext(replyText);
  const inferredId = stableId("telegram_pick", alert.away_team, alert.home_team, alert.market, alert.pick_side, alert.game_time);
  const betId = extractBetId(replyText);
  const sportsbook = bestRetail.sportsbook || extractSportsbook(replyText) || clean(process.env.TAIL_BOT_DEFAULT_SPORTSBOOK);
  const odds = bestRetail.odds || extractAmericanOdds(replyText);
  const identity = telegramIdentity(update);

  if (!betId && !alert.has_context) return { ok: false, error: "missing_bet_id" };
  if (!sportsbook) return { ok: false, error: "missing_sportsbook" };
  if (!odds) return { ok: false, error: "missing_odds" };

  return {
    ok: true,
    action: "tail",
    tail: {
      bet_id: betId,
      pick_id: betId ? "" : inferredId,
      email: "",
      sportsbook,
      odds_taken: odds,
      stake: String(stake),
      pick_side: alert.pick_side || extractAlertPick(replyText),
      market: alert.market,
      sport: alert.sport,
      away_team: alert.away_team,
      home_team: alert.home_team,
      placed_at: new Date().toISOString(),
      source: "telegram_button",
      notes: tailNote(`button:${data}`, String(stake), bestRetail, alert, betId),
      raw_telegram_update_id: identity.update_id,
      telegram_chat_id: identity.chat_id,
      telegram_user_id: identity.user_id,
      telegram_username: identity.username,
    },
  };
}

async function parseTelegramAccountLink(update) {
  const message = telegramMessage(update);
  const text = clean(message.text || message.caption);
  const match = text.match(/^\/?link\s+([A-Z0-9]{6,12})$/i);
  if (!match) return { ok: false, action: "not_link" };
  const identity = telegramIdentity(update);
  if (!identity.user_id) {
    return { ok: true, action: "link", linked: false, message: "I could not see your Telegram user ID. Try sending /link CODE directly from your own account." };
  }
  const result = await consumeTelegramLinkCode(match[1], identity, update);
  return {
    ok: true,
    action: "link",
    linked: result.ok,
    message: result.ok
      ? `Telegram linked to ${result.email}. Future replies will land in your personal ledger.`
      : `I could not link that code: ${result.error}. Generate a fresh code from the member dashboard and try again.`,
  };
}

function telegramIdentity(update) {
  const callback = telegramCallback(update);
  const message = callback.message || telegramMessage(update);
  const from = callback.from || message.from || {};
  return {
    update_id: clean(update.update_id),
    chat_id: clean((message.chat || {}).id),
    user_id: clean(from.id),
    username: clean(from.username),
  };
}

async function consumeTelegramLinkCode(code, identity, update) {
  const normalized = clean(code).toUpperCase();
  try {
    const rows = await supabaseRead(
      `telegram_link_codes?select=*&code=eq.${encodeURIComponent(normalized)}&used_at=is.null&expires_at=gte.${encodeURIComponent(new Date().toISOString())}&limit=1`
    );
    const row = rows[0];
    if (!row) return { ok: false, error: "expired_or_invalid_code" };
    const now = new Date().toISOString();
    await supabaseUpsert(
      "telegram_accounts",
      {
        telegram_user_id: identity.user_id,
        user_id: row.user_id || null,
        email: clean(row.email).toLowerCase(),
        telegram_username: identity.username,
        telegram_chat_id: identity.chat_id,
        last_seen_at: now,
        linked_at: now,
        source: "telegram_link_code",
        raw_json: update || {},
        updated_at: now,
      },
      "telegram_user_id"
    );
    await supabasePatch("telegram_link_codes", `code=eq.${encodeURIComponent(normalized)}`, {
      used_at: now,
      used_by_telegram_user_id: identity.user_id,
      updated_at: now,
    });
    return { ok: true, email: clean(row.email).toLowerCase() };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  }
}

async function resolveTailIdentity(tail) {
  const telegramUserId = clean(tail.telegram_user_id);
  const fallbackEmail = clean(process.env.TAIL_BOT_DEFAULT_EMAIL).toLowerCase();
  let email = clean(tail.email).toLowerCase();
  let accountLinkStatus = email ? "provided_email" : "unlinked";

  if (telegramUserId) {
    try {
      const rows = await supabaseRead(
        `telegram_accounts?select=email,telegram_username&telegram_user_id=eq.${encodeURIComponent(telegramUserId)}&limit=1`
      );
      const account = rows[0];
      if (account?.email) {
        email = clean(account.email).toLowerCase();
        accountLinkStatus = "linked";
      }
    } catch {
      accountLinkStatus = "lookup_failed";
    }
  }

  if (!email && fallbackEmail) {
    email = fallbackEmail;
    accountLinkStatus = accountLinkStatus === "lookup_failed" ? "lookup_failed_fallback" : "fallback_default_email";
  }

  const notes = [clean(tail.notes)];
  if (accountLinkStatus !== "linked") {
    notes.push(`telegram account link status: ${accountLinkStatus}`);
  }
  return {
    ...tail,
    email,
    account_link_status: accountLinkStatus,
    notes: notes.filter(Boolean).join(" | "),
  };
}

function extractBetId(text) {
  const patterns = [
    /\bbet[_\s-]*id\s*[:=]?\s*`?([A-Za-z0-9_.:@-]{4,})`?/i,
    /\b(?:bet|pick)\s*#\s*([A-Za-z0-9_.:@-]{4,})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return clean(match[1]);
  }
  return "";
}

function extractBestRetail(text) {
  const match = text.match(/\bBest\s+(?:retail|available|price)\s*:\s*([A-Za-z][A-Za-z0-9 .'-]{1,30})\s+([+-]\s*\d{3,4})\b/i);
  if (!match) return { sportsbook: "", odds: "" };
  return {
    sportsbook: normalizeSportsbook(match[1]),
    odds: match[2].replace(/\s+/g, ""),
  };
}

function extractSportsbook(text) {
  for (const [name, pattern] of BOOK_ALIASES) {
    if (pattern.test(text)) return name;
  }
  const match = text.match(/\bat\s+([A-Za-z][A-Za-z0-9 ]{2,24})\b/i);
  return match ? normalizeSportsbook(match[1]) : "";
}

function normalizeSportsbook(value) {
  const cleanValue = clean(value);
  for (const [name, pattern] of BOOK_ALIASES) {
    if (pattern.test(cleanValue)) return name;
  }
  return cleanValue;
}

function extractAmericanOdds(text) {
  const match = text.match(/(?:odds\s*)?([+-]\s*\d{3,4})\b/i);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function extractStake(text) {
  const patterns = [
    /\$([0-9]+(?:\.[0-9]{1,2})?)/,
    /\b(?:stake|risk|for)\s+\$?\s*([0-9]+(?:\.[0-9]{1,2})?)\b/i,
    /\b([0-9]+(?:\.[0-9]{1,2})?)\s*(?:u|unit|units|dollars|bucks)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return clean(match[1]);
  }
  return "";
}

function extractPickSide(text) {
  const cleaned = clean(text.replace(/\/tail\b/i, ""));
  const beforeOdds = cleaned.split(/[+-]\s*\d{3,4}\b/)[0] || "";
  return beforeOdds
    .replace(/\b(i\s+)?(bet|tailed|tail|took|played|got|at|on|for|odds|stake|risk)\b/gi, " ")
    .replace(/\b(draft\s*kings|draftkings|dk|fan\s*duel|fanduel|fd|caesars|bet\s*mgm|betmgm|mgm|fanatics|espn\s*bet|bet365|hard\s*rock)\b/gi, " ")
    .replace(/\$?\b[0-9]+(?:\.[0-9]{1,2})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function extractAlertPick(text) {
  const match = text.match(/\b(?:Pick|Side)\s*:\s*([^\n|]+)/i);
  return match ? clean(match[1]).slice(0, 80) : "";
}

function extractAlertContext(text) {
  const lines = clean(text)
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean);
  const gameLine = lines.find((line) => /\s(@|vs\.?|v\.?)\s/i.test(line)) || "";
  const game = extractGame(gameLine);
  const marketSide = clean(lines.find((line) => /\bMarket\s*:/i.test(line)) || "");
  const marketMatch = marketSide.match(/\bMarket\s*:\s*([^|]+)/i);
  const sideMatch = marketSide.match(/\bSide\s*:\s*([^\n|]+)/i);
  const gameTime = clean((text.match(/\bGame\s*time\s*:\s*([^\n]+)/i) || [])[1]);
  return {
    has_context: Boolean(game.away_team && game.home_team && (marketMatch || sideMatch)),
    sport: "",
    away_team: game.away_team,
    home_team: game.home_team,
    market: marketMatch ? clean(marketMatch[1]) : "",
    pick_side: sideMatch ? clean(sideMatch[1]) : "",
    game_time: gameTime,
  };
}

function extractGame(line) {
  const match = clean(line).match(/^(.+?)\s+(?:@|vs\.?|v\.?)\s+(.+)$/i);
  if (!match) return { away_team: "", home_team: "" };
  return {
    away_team: clean(match[1]).slice(0, 80),
    home_team: clean(match[2]).slice(0, 80),
  };
}

function isGenericTailPick(value) {
  const cleaned = clean(value).toLowerCase();
  return (
    !cleaned ||
    /^(i\s+)?(placed\s+)?(this|it|here|that)(\s+(bet|game|play|pick))?(\s+\$?\d+(?:\.\d{1,2})?)?$/.test(cleaned)
  );
}

function tailNote(text, stake, bestRetail, alert, betId) {
  const parts = [`telegram_tail: ${text}`];
  if (stake === "1" && !extractStake(text)) {
    parts.push("stake missing, recorded as 1 unit");
  }
  if (!betId && alert.has_context) {
    parts.push("bet_id missing from alert; tracked by inferred pick_id from replied alert context");
  }
  if (bestRetail.sportsbook || bestRetail.odds) {
    parts.push(`price inferred from replied alert: ${[bestRetail.sportsbook, bestRetail.odds].filter(Boolean).join(" ")}`);
  }
  return parts.join(" | ");
}

async function replyToTelegram(update, text) {
  const token = clean(process.env.TELEGRAM_TAIL_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const callback = telegramCallback(update);
  const message = callback.message || telegramMessage(update);
  const chatId = clean((message.chat || {}).id);
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: message.message_id,
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    return;
  }
}

async function answerCallback(update, text) {
  const token = clean(process.env.TELEGRAM_TAIL_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const callbackId = clean((telegramCallback(update) || {}).id);
  if (!token || !callbackId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: false,
      }),
    });
  } catch (error) {
    return;
  }
}

function confirmationText(result, tail) {
  if (result && result.ok) {
    const status = result.tail_bets_synced === false ? "fallback; ledger migration pending" : result.grade?.status || "open";
    const pick = tail.pick_side || [tail.away_team, tail.home_team].filter(Boolean).join(" @ ") || "tail";
    const stake = tail.stake ? `$${tail.stake}` : "1 unit";
    const grade = result.grade?.status === "closed" ? ` Result: ${result.grade.result}; P&L ${moneyText(result.grade.pnl)}.` : " Auto-grading after final and CLV settle.";
    return `Logged ${pick} ${tail.odds_taken} ${tail.sportsbook} ${stake}. Current status: ${status}.${grade}`;
  }
  return `I could not log that tail: ${(result || {}).error || "unknown_error"}.`;
}

function moneyText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function moneyAmount(value) {
  const number = Number(clean(value).replace("$", "").replace(",", ""));
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
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
  try {
    await supabaseUpsert("tail_bets", row, "tail_bet_id");
    tailBetsSynced = true;
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
    telegram_user_id: clean(body.telegram_user_id),
    telegram_username: clean(body.telegram_username),
    telegram_chat_id: clean(body.telegram_chat_id),
    raw_telegram_update_id: clean(body.raw_telegram_update_id),
    account_link_status: clean(body.account_link_status) || "unknown",
    placed_at: placedAt,
    source: clean(body.source) || "telegram_reply",
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

async function supabasePatch(table, filter, patch) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }

  const response = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`supabase_${table}_patch_failed_${response.status}: ${await response.text()}`);
  }
}

async function supabaseRead(path) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`supabase_read_failed_${response.status}: ${await response.text()}`);
  }
  return response.json();
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
    source: "telegram",
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
      telegram_user_id: row.telegram_user_id,
      telegram_username: row.telegram_username,
      telegram_chat_id: row.telegram_chat_id,
      account_link_status: row.account_link_status,
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

function stableId(...parts) {
  const source = parts.map(clean).filter(Boolean).join(":");
  return `${clean(parts[0]) || "id"}_${crypto.createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

function helpText(error) {
  if (error === "missing_bet_id") {
    return "Reply directly to the pick alert, or include bet_id. Example: DraftKings -155 $25";
  }
  if (error === "missing_sportsbook") {
    return "I need the sportsbook. Example: DraftKings -155 $25";
  }
  if (error === "missing_odds") {
    return "I need the odds you actually took. Example: DraftKings -155 $25";
  }
  return "Send a tail like: DraftKings -155 $25. If not replying to an alert, include bet_id.";
}

function clean(value) {
  return String(value || "").trim();
}

export const _private = {
  parseTelegramTail,
  parseTelegramCallback,
  extractBetId,
  extractSportsbook,
  extractBestRetail,
  extractAmericanOdds,
  extractStake,
  extractPickSide,
  extractAlertPick,
  extractAlertContext,
  isGenericTailPick,
  confirmationText,
  resolveTailIdentity,
  parseTelegramAccountLink,
};
