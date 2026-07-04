const tailBets = require("./tail-bets.js");

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const update = typeof req.body === "object" && req.body ? req.body : {};
  const parsed = parseTelegramTail(update);
  if (!parsed.ok) {
    await replyToTelegram(update, helpText(parsed.error));
    return res.status(200).json(parsed);
  }

  const result = await tailBets._private.submitTailBet(parsed.tail);
  await replyToTelegram(update, confirmationText(result.body, parsed.tail));
  return res.status(200).json({ ok: result.body.ok, tail: parsed.tail, capture: result.body });
};

function authorized(req) {
  const expected = clean(process.env.TELEGRAM_TAIL_WEBHOOK_SECRET);
  if (!expected) return true;
  const querySecret = clean((req.query || {}).secret);
  const headerSecret = clean((req.headers || {})["x-telegram-bot-api-secret-token"]);
  return querySecret === expected || headerSecret === expected;
}

function parseTelegramTail(update) {
  const message = update.message || update.edited_message || {};
  const text = clean(message.text || message.caption);
  const replyText = clean((message.reply_to_message || {}).text || (message.reply_to_message || {}).caption);
  const sourceText = `${text}\n${replyText}`.trim();
  const bestRetail = extractBestRetail(replyText);
  const betId = extractBetId(sourceText);
  const sportsbook = extractSportsbook(text) || bestRetail.sportsbook || extractSportsbook(replyText);
  const odds = extractAmericanOdds(text) || bestRetail.odds || extractAmericanOdds(replyText);
  const stake = extractStake(text) || "1";
  const email = clean(process.env.TAIL_BOT_DEFAULT_EMAIL);

  if (!text) return { ok: false, error: "empty_message" };
  if (!betId) return { ok: false, error: "missing_bet_id" };
  if (!sportsbook) return { ok: false, error: "missing_sportsbook" };
  if (!odds) return { ok: false, error: "missing_odds" };
  const textPick = extractPickSide(text);
  const alertPick = extractAlertPick(replyText);

  return {
    ok: true,
    tail: {
      bet_id: betId,
      email,
      sportsbook,
      odds_taken: odds,
      stake,
      pick_side: isGenericTailPick(textPick) ? alertPick : textPick || alertPick,
      placed_at: new Date().toISOString(),
      source: "telegram_reply",
      notes: tailNote(text, stake, bestRetail),
      raw_telegram_update_id: clean(update.update_id),
      telegram_chat_id: clean((message.chat || {}).id),
      telegram_user_id: clean((message.from || {}).id),
      telegram_username: clean((message.from || {}).username),
    },
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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function extractAlertPick(text) {
  const match = text.match(/\b(?:Pick|Side)\s*:\s*([^\n|]+)/i);
  return match ? clean(match[1]).slice(0, 80) : "";
}

function isGenericTailPick(value) {
  const cleaned = clean(value).toLowerCase();
  return !cleaned || /^(i\s+)?(placed\s+)?this(\s+bet)?(\s+\$?\d+(?:\.\d{1,2})?)?$/.test(cleaned);
}

function tailNote(text, stake, bestRetail) {
  const parts = [`telegram_tail: ${text}`];
  if (stake === "1" && !extractStake(text)) {
    parts.push("stake missing, recorded as 1 unit");
  }
  if (bestRetail.sportsbook || bestRetail.odds) {
    parts.push(`price inferred from replied alert: ${[bestRetail.sportsbook, bestRetail.odds].filter(Boolean).join(" ")}`);
  }
  return parts.join(" | ");
}

async function replyToTelegram(update, text) {
  const token = clean(process.env.TELEGRAM_TAIL_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const message = update.message || update.edited_message || {};
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

function confirmationText(result, tail) {
  if (result && result.ok) {
    const status = result.tail_bets_synced === false ? "captured in fallback; ledger migration pending" : "logged";
    return `Tail ${status}: ${tail.sportsbook} ${tail.odds_taken}, stake ${tail.stake}.`;
  }
  return `I could not log that tail: ${(result || {}).error || "unknown_error"}.`;
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

module.exports._private = {
  parseTelegramTail,
  extractBetId,
  extractSportsbook,
  extractBestRetail,
  extractAmericanOdds,
  extractStake,
  extractPickSide,
  extractAlertPick,
  isGenericTailPick,
  confirmationText,
};
