import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requireServerUser } from '../lib/authServer';

export async function getServerSideProps({ req, res }) {
  res.setHeader('Cache-Control', 'private, no-store');
  const auth = await requireServerUser(req, res);
  if (!auth.user) return { redirect: { destination: '/signin?next=%2Fresults', permanent: false } };
  return { props: {} };
}
const money = n => n === null || n === undefined ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
const stamp = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'Not reported';

export default function Results() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [consent, setConsent] = useState(false);
  const [linkUrl, setLinkUrl] = useState(''), [notice, setNotice] = useState('');
  async function request(body, configurationOnly = false) {
    const r = await fetch('/api/sportsbook-results' + (configurationOnly ? '?view=configuration' : ''), { method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const value = await r.json();
    if (!r.ok) throw Error(value.error || value.message || 'Results unavailable.');
    return value;
  }
  async function load() {
    setBusy(true); setError('');
    try {
      const configuration = await request(null, true);
      setData(configuration);
      if (configuration.configured) setData(await request());
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  async function connect() {
    setBusy(true); setError(''); setLinkUrl('');
    try {
      const session = await request({ action: 'link', consent });
      // Load once per page: the provider script registers document-level listeners.
      if (!document.getElementById('sharpsports-extension')) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script'); script.id = 'sharpsports-extension';
          script.src = 'https://d1vhnbpkpweicq.cloudfront.net/extension-cdn.js';
          script.setAttribute('internalId', session.internalId); script.setAttribute('publicKey', session.publicKey);
          script.setAttribute('extensionAuthToken', session.extensionAuthToken);
          script.onload = resolve; script.onerror = () => { script.remove(); reject(Error('Connection helper could not load. Please reload the page.')); };
          document.body.appendChild(script);
        });
      } else {
        // Refresh the globals consumed by the provider's documented extension bridge.
        window.internalId = session.internalId; window.publicKey = session.publicKey;
        window.extensionAuthToken = session.extensionAuthToken;
      }
      setLinkUrl(session.linkUrl);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function disconnect(accountId) {
    setBusy(true); setError(''); setNotice('');
    try { await request({ action: 'disconnect', accountId }); setNotice('Sandbox account access removed.'); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="member-shell">
    <aside className="member-nav"><span className="eyebrow">YOUR WORKSPACE</span><Link href="/dashboard">Dashboard</Link><Link href="/results" aria-current="page">My results</Link></aside>
    <div className="member-content">
      <div className="member-top"><span className="eyebrow">MY RESULTS</span><span className="status-pill">Sandbox · test data only</span></div>
      <h1>Your results, together.</h1>
      <p className="muted">Test connecting sportsbook history and viewing settled results in one place.</p>
      <section className="member-panel"><h2>Sandbox connections</h2>
        <p>We’re testing FanDuel, BetMGM, Caesars and DraftKings. Availability depends on the provider, region and device; no live connection is enabled.</p>
        <p className="small muted">FanDuel, DraftKings and BetMGM web linking require desktop Chrome with the provider’s extension. An iPhone browser alone is not supported by that linking path. Caesars does not require that extension in the sandbox catalog.</p>
        {!data && !error && <p role="status">Loading connection status…</p>}
        {data?.configured === false && <div className="empty-state"><h3>Sandbox setup is pending.</h3><p>The developer account and sandbox keys must be configured before test accounts can connect.</p></div>}
        {data?.configured && <>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', margin: '20px 0' }}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>I agree to share sandbox account history with SharpSports and Sharp Signals for results tracking. I will use test credentials only. Sharp Signals does not collect my sportsbook password.</span></label>
          <button className="button-primary" disabled={busy || !consent} onClick={connect}>Prepare sandbox connection</button>
          {linkUrl && consent && <p><a className="button-secondary" href={linkUrl} target="_blank" rel="noopener noreferrer">Open sandbox linking ↗</a></p>}
          <p className="small muted">Use SharpSports’ sandbox login: gooduser / Test1. After linking, return here and reload results.</p>
          <ul>{data.accounts?.map(account => <li key={account.id} style={{ margin: '16px 0' }}><b>{account.book}</b> — {account.paused ? 'Paused' : account.verified ? 'Connected in sandbox' : 'Needs reconnection'} <button className="text-button" disabled={busy} onClick={() => disconnect(account.id)}>Disconnect</button></li>)}</ul>
          {data.accounts?.length === 0 && <p>No sandbox accounts connected yet.</p>}
          {!data.accounts && <p>Account status unavailable. You can start a sandbox connection or reload this page.</p>}
        </>}
        <p role="status">{notice}</p><p role="alert" className="error-message">{error}</p>
      </section>
      {data?.configured && !data.summary && <button className="button-secondary" disabled={busy} onClick={load}>Retry loading results</button>}
      {data?.summary && <section className="member-panel"><div className="panel-title"><h2>Imported test results</h2><button className="button-secondary" disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Reload results'}</button></div>
        <p className="small muted">Latest 100 provider records. Reload reads the provider’s saved history; it does not request a new sportsbook sync. Last sync requested: {stamp(data.lastRefresh)}. Retrieved: {stamp(data.fetchedAt)}.</p>
        <div className="member-stats"><article><small>Shown test slips</small><b>{data.summary.count}</b></article><article><small>Settled test slips</small><b>{data.summary.settled}</b></article><article><small>Known net result · shown slips</small><b>{money(data.summary.netProfitCents)}</b></article></div>
        {data.summary.missingProfit > 0 && <p>{data.summary.missingProfit} settled slips have no reported net result and are excluded from the total.</p>}
        {data.limited && <p>This is a limited view, not your full account history.</p>}
        {!data.slips.length ? <div className="empty-state"><h3>No imported test results yet.</h3><p>Connect a sandbox account to test the import.</p></div> : <div className="member-table"><table><thead><tr><th>Sportsbook / selection</th><th>Placed</th><th>Stake</th><th>Outcome</th><th>Net result</th></tr></thead><tbody>{data.slips.map(s => <tr key={s.id}><td><b>{s.book}</b><small>{s.description}</small>{s.incomplete && <small>Some details unavailable</small>}</td><td>{stamp(s.placedAt)}</td><td>{money(s.stakeCents)}</td><td>{s.outcome || s.status}</td><td>{money(s.netProfitCents)}</td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  </main>;
}
