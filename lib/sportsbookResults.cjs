const { createHmac, createHash } = require('node:crypto');
const BOOKS = ['FanDuel', 'BetMGM', 'Caesars', 'DraftKings'];
const analytics = require('./betInsights.cjs');
class ResultsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function configuration(env) {
  if (env.SHARPSPORTS_MODE === 'live') {
    const publicKey = env.SHARPSPORTS_PUBLIC_KEY || '';
    const privateKey = env.SHARPSPORTS_PRIVATE_KEY || '';
    const identitySecret = env.SHARPSPORTS_IDENTITY_SECRET || '';
    const pilotUsers = (env.SHARPSPORTS_PILOT_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    return { mode: 'live', publicKey, privateKey, identitySecret, pilotUsers,
      ready: Boolean(publicKey && privateKey && publicKey !== privateKey && identitySecret.length >= 32 && pilotUsers.length) };
  }
  // SharpSports documents a single sandbox key for public and private calls.
  const publicKey = env.SHARPSPORTS_SANDBOX_KEY || '';
  const privateKey = publicKey;
  const identitySecret = env.SHARPSPORTS_IDENTITY_SECRET || '';
  // Key prefixes do not distinguish environments: the issued sandbox key is hex.
  // Pin the credential independently confirmed in the provider's sandbox console.
  const pin = env.SHARPSPORTS_SANDBOX_KEY_SHA256 || '';
  const ready = env.SHARPSPORTS_SANDBOX_ENABLED === 'true' &&
    Boolean(publicKey) && /^[a-f0-9]{64}$/.test(pin) &&
    createHash('sha256').update(publicKey).digest('hex') === pin && identitySecret.length >= 32;
  return { ready, publicKey, privateKey, identitySecret, mode: 'sandbox' };
}
function internalId(userId, secret, mode = 'sandbox') {
  return 'ss_' + mode + '_' + createHmac('sha256', secret).update(userId).digest('hex');
}
function rows(value) {
  if (!Array.isArray(value)) throw new ResultsError(502, 'The results provider returned an unexpected response.');
  return value;
}
const cents = value => typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
const text = value => typeof value === 'string' ? value : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const objectId = value => typeof value === 'string' ? value : value?.id;
function normalizeSlip(slip) {
  return {
    id: slip.id, book: slip.book?.name || 'Unknown sportsbook',
    description: (Array.isArray(slip.bets) ? slip.bets : []).map(b => b.bookDescription).filter(Boolean).join(' · ') || 'Description unavailable',
    type: slip.type || 'unknown', placedAt: slip.timePlaced || null,
    bookReference: text(slip.bookRef), oddsAmerican: cents(slip.oddsAmerican),
    toWinCents: cents(slip.toWin), closedAt: text(slip.timeClosed), closedDate: text(slip.dateClosed),
    adjustedStakeCents: cents(slip.adjusted?.atRisk),
    market: slip.type !== 'single' ? (text(slip.subtype) || 'parlay') :
      (slip.incomplete ? 'Unknown market' : text(slip.bets?.[0]?.proposition) || 'Unknown market'),
    league: slip.type === 'single' ? text(slip.bets?.[0]?.event?.league) : 'Multiple / parlay',
    legs: (Array.isArray(slip.bets) ? slip.bets : []).map(b => ({
      id: text(b.id), description: text(b.bookDescription), event: text(b.event?.name),
      position: text(b.position), line: number(b.line), oddsAmerican: cents(b.oddsAmerican),
      status: text(b.status), outcome: text(b.outcome), incomplete: b.incomplete === true,
    })),
    status: slip.status || 'unknown', outcome: slip.outcome || null,
    stakeCents: cents(slip.atRisk),
    // Provider accounting is authoritative, including cashouts and partial outcomes.
    netProfitCents: slip.status === 'completed' ? cents(slip.netProfit) : null,
    incomplete: Boolean(slip.incomplete),
  };
}
function summary(slips) {
  const completed = slips.filter(s => s.status === 'completed');
  const known = completed.filter(s => s.netProfitCents !== null);
  return { count: slips.length, settled: completed.length, missingProfit: completed.length - known.length,
    netProfitCents: known.length ? known.reduce((sum, s) => sum + s.netProfitCents, 0) : null };
}
function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    return ['https:', 'http:'].includes(origin.protocol) && origin.host === req.headers.host &&
      (origin.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname));
  } catch { return false; }
}

function createHandler({ getUser, env = process.env, fetchImpl = fetch, interpretQuestion }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).json({ error: 'Request origin rejected.' });
    const user = await getUser(req, res);
    if (!user?.id || !user.email_confirmed_at) return res.status(401).json({ error: 'Sign in with a verified email.' });
    const config = configuration(env);
    const mode = config.mode;
    if (mode === 'live' && config.ready && !config.pilotUsers.includes(user.id)) return res.status(403).json({ error: 'Live connections are available to the pilot account only.', mode });
    if (!config.ready) return res.status(req.method === 'GET' ? 200 : 503).json({
      mode, configured: false, books: BOOKS,
      message: mode === 'live' ? 'Live provider setup is pending.' : 'Sandbox connection setup is pending. No sportsbook accounts are connected through this feature.'
    });
    if (req.method === 'GET' && req.query?.view === 'configuration') {
      return res.json({ mode, configured: true, books: BOOKS });
    }
    const id = internalId(user.id, config.identitySecret, mode);
    async function api(path, { method = 'GET', body, publicKey = false, missing = false } = {}) {
      let response;
      try {
        response = await fetchImpl('https://api.sharpsports.io/v1' + path, {
          method, headers: { Authorization: 'Token ' + (publicKey ? config.publicKey : config.privateKey), 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error'
        });
      } catch { throw new ResultsError(503, 'The results provider is unavailable. Please try again later.'); }
      if (missing && response.status === 404) return null;
      if (!response.ok) throw new ResultsError(502, 'The sportsbook provider request failed. No successful connection or update is confirmed.');
      if (response.status === 204) return null;
      return response.json();
    }
    try {
      if (req.method === 'POST' && req.body?.action !== 'ask') {
        const body = req.body || {};
        if (body.action === 'link') {
          if (body.consent !== true) throw new ResultsError(400, 'Consent is required before connecting a sportsbook account.');
          const auth = await api('/extension/auth', { method: 'POST', body: { internalId: id } });
          if (typeof auth.token !== 'string' || !auth.token) throw new ResultsError(502, 'Sandbox extension authorization could not be verified.');
          const context = await api('/context', { method: 'POST', publicKey: true,
            body: { internalId: id, extensionAuthToken: auth.token, uiMode: 'light' } });
          if (typeof context.cid !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(context.cid)) throw new ResultsError(502, 'Sandbox connection session could not be verified.');
          return res.json({ mode, internalId: id, publicKey: config.publicKey,
            extensionAuthToken: auth.token, linkUrl: 'https://ui.sharpsports.io/link/' + context.cid });
        }
        if (body.action === 'disconnect') {
          if (typeof body.accountId !== 'string' || !/^BACT_[a-zA-Z0-9_-]+$/.test(body.accountId)) throw new ResultsError(400, 'Invalid account.');
          const accounts = rows(await api('/bettors/' + id + '/bettorAccounts', { missing: true }) || []);
          if (!accounts.some(a => a.id === body.accountId)) throw new ResultsError(404, 'Account not found.');
          await api('/bettorAccounts/' + encodeURIComponent(body.accountId) + '/access', { method: 'PUT', body: { access: false } });
          return res.json({ ok: true, mode });
        }
        throw new ResultsError(400, 'Unknown action.');
      }
      const bettor = await api('/bettors/' + id, { missing: true });
      if (bettor && bettor.internalId !== id) throw new ResultsError(502, 'Account ownership could not be verified.');
      const accounts = bettor ? rows(await api('/bettors/' + id + '/bettorAccounts')) : [];
      // Read provider history only; loading the page never triggers a paid book refresh.
      const raw = [];
      let totalPages = 0, pagesRead = 0;
      if (bettor) {
        for (let page = 1; page <= 20; page++) {
          const result = await api('/bettors/' + id + '/betSlips?pageSize=100&pageNum=' + page);
          if (!result || !Array.isArray(result.objects) || !Number.isInteger(result.totalPages) || result.totalPages < 0) throw new ResultsError(502, 'Provider pagination could not be verified.');
          totalPages = result.totalPages; pagesRead = page; raw.push(...result.objects);
          if (page >= totalPages) break;
        }
      }
      const owned = new Set(accounts.filter(a => a.access !== false).map(a => a.id));
      const seen = new Set();
      const slips = raw.filter(s => {
        if (!s.id || seen.has(s.id) || !owned.has(objectId(s.bettorAccount)) || objectId(s.bettor) !== bettor.id) return false;
        seen.add(s.id); return true;
      }).map(normalizeSlip);
      let filtered;
      try { filtered = analytics.filterSlips(slips, req.method === 'POST' ? req.body?.filters : req.query); }
      catch (error) { throw new ResultsError(400, error.message); }
      if (req.method === 'POST' && req.body?.action === 'ask') {
        const question = req.body.question;
        if (typeof question !== 'string' || !question.trim() || question.length > 500) throw new ResultsError(400, 'Ask a question of 1–500 characters.');
        if (!interpretQuestion) throw new ResultsError(503, 'Bet questions are not configured yet. The performance tables remain available.');
        let plan;
        try { plan = await interpretQuestion(question); }
        catch { throw new ResultsError(503, 'Bet questions are temporarily unavailable. Please use the performance tables or try again later.'); }
        return res.json({mode, ...analytics.answer(plan, filtered), limited: totalPages > pagesRead, sampleCount: filtered.length, fetchedAt: new Date().toISOString()});
      }
      return res.json({ mode, configured: true, books: BOOKS,
        accounts: accounts.filter(a => a.access !== false).map(a => ({ id: a.id, book: a.book?.name || 'Sportsbook',
          verified: a.verified === true, paused: a.paused === true, lastRefresh: a.betRefreshRequested || null })),
        slips: filtered, summary: summary(filtered), analytics: analytics.insights(filtered), fetchedAt: new Date().toISOString(),
        options: {books: [...new Set(slips.map(s=>s.book))], markets: [...new Set(slips.map(s=>s.market))]},
        limited: totalPages > pagesRead, pagesRead, totalPages, lastRefresh: bettor?.betRefreshRequested || null });
    } catch (error) {
      return res.status(error instanceof ResultsError ? error.status : 502).json({
        error: error instanceof ResultsError ? error.message : 'Sportsbook results could not be loaded.', mode
      });
    }
  };
}
module.exports = { createHandler, configuration, internalId, normalizeSlip, summary };
