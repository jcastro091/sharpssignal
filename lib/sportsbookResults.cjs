const { createHmac } = require('node:crypto');
const BOOKS = ['FanDuel', 'BetMGM', 'Caesars', 'DraftKings'];
class ResultsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function configuration(env) {
  // SharpSports documents a single sandbox key for public and private calls.
  const publicKey = env.SHARPSPORTS_SANDBOX_KEY || '';
  const privateKey = publicKey;
  const identitySecret = env.SHARPSPORTS_IDENTITY_SECRET || '';
  // This release deliberately cannot accept live credentials.
  const ready = env.SHARPSPORTS_SANDBOX_ENABLED === 'true' &&
    /^(public_)?sandbox_/.test(publicKey) && identitySecret.length >= 32;
  return { ready, publicKey, privateKey, identitySecret };
}
function internalId(userId, secret) {
  return 'ss_sandbox_' + createHmac('sha256', secret).update(userId).digest('hex');
}
function rows(value) {
  if (!Array.isArray(value)) throw new ResultsError(502, 'The results provider returned an unexpected response.');
  return value;
}
const cents = value => typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
const objectId = value => typeof value === 'string' ? value : value?.id;
function normalizeSlip(slip) {
  return {
    id: slip.id, book: slip.book?.name || 'Unknown sportsbook',
    description: (Array.isArray(slip.bets) ? slip.bets : []).map(b => b.bookDescription).filter(Boolean).join(' · ') || 'Description unavailable',
    type: slip.type || 'unknown', placedAt: slip.timePlaced || null,
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

function createHandler({ getUser, env = process.env, fetchImpl = fetch }) {
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
    if (!config.ready) return res.status(req.method === 'GET' ? 200 : 503).json({
      mode: 'sandbox', configured: false, books: BOOKS,
      message: 'Sandbox connection setup is pending. No sportsbook accounts are connected through this feature.'
    });
    if (req.method === 'GET' && req.query?.view === 'configuration') {
      return res.json({ mode: 'sandbox', configured: true, books: BOOKS });
    }
    const id = internalId(user.id, config.identitySecret);
    async function api(path, { method = 'GET', body, publicKey = false, missing = false } = {}) {
      let response;
      try {
        response = await fetchImpl('https://api.sharpsports.io/v1' + path, {
          method, headers: { Authorization: 'Token ' + (publicKey ? config.publicKey : config.privateKey), 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error'
        });
      } catch { throw new ResultsError(503, 'The results provider is unavailable. Please try again later.'); }
      if (missing && response.status === 404) return null;
      if (!response.ok) throw new ResultsError(502, 'The sandbox provider request failed. No successful connection or update is confirmed.');
      if (response.status === 204) return null;
      return response.json();
    }
    try {
      if (req.method === 'POST') {
        const body = req.body || {};
        if (body.action === 'link') {
          if (body.consent !== true) throw new ResultsError(400, 'Consent is required before connecting a sandbox account.');
          const auth = await api('/extension/auth', { method: 'POST', body: { internalId: id } });
          if (typeof auth.token !== 'string' || !auth.token) throw new ResultsError(502, 'Sandbox extension authorization could not be verified.');
          const context = await api('/context', { method: 'POST', publicKey: true,
            body: { internalId: id, extensionAuthToken: auth.token, uiMode: 'light' } });
          if (typeof context.cid !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(context.cid)) throw new ResultsError(502, 'Sandbox connection session could not be verified.');
          return res.json({ mode: 'sandbox', internalId: id, publicKey: config.publicKey,
            extensionAuthToken: auth.token, linkUrl: 'https://ui.sharpsports.io/link/' + context.cid });
        }
        if (body.action === 'disconnect') {
          if (typeof body.accountId !== 'string' || !/^BACT_[a-zA-Z0-9_-]+$/.test(body.accountId)) throw new ResultsError(400, 'Invalid account.');
          const accounts = rows(await api('/bettors/' + id + '/bettorAccounts'));
          if (!accounts.some(a => a.id === body.accountId)) throw new ResultsError(404, 'Account not found.');
          await api('/bettorAccounts/' + encodeURIComponent(body.accountId) + '/access', { method: 'PUT', body: { access: false } });
          return res.json({ ok: true, mode: 'sandbox' });
        }
        throw new ResultsError(400, 'Unknown action.');
      }
      const bettor = await api('/bettors/' + id, { missing: true });
      if (bettor && bettor.internalId !== id) throw new ResultsError(502, 'Account ownership could not be verified.');
      const accounts = bettor ? rows(await api('/bettors/' + id + '/bettorAccounts')) : [];
      const raw = bettor ? rows(await api('/bettors/' + id + '/betSlips?limit=100')) : [];
      const owned = new Set(accounts.filter(a => a.access !== false).map(a => a.id));
      const seen = new Set();
      const slips = raw.filter(s => {
        if (!s.id || seen.has(s.id) || !owned.has(objectId(s.bettorAccount)) || objectId(s.bettor) !== bettor.id) return false;
        seen.add(s.id); return true;
      }).map(normalizeSlip);
      return res.json({ mode: 'sandbox', configured: true, books: BOOKS,
        accounts: accounts.filter(a => a.access !== false).map(a => ({ id: a.id, book: a.book?.name || 'Sportsbook',
          verified: a.verified === true, paused: a.paused === true, lastRefresh: a.betRefreshRequested || null })),
        slips, summary: summary(slips), fetchedAt: new Date().toISOString(),
        limited: raw.length >= 100, lastRefresh: bettor?.betRefreshRequested || null });
    } catch (error) {
      return res.status(error instanceof ResultsError ? error.status : 502).json({
        error: error instanceof ResultsError ? error.message : 'Sandbox results could not be loaded.', mode: 'sandbox'
      });
    }
  };
}
module.exports = { createHandler, configuration, internalId, normalizeSlip, summary };
