import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requireServerUser } from '../lib/authServer';
import styles from '../styles/results.module.css';

export async function getServerSideProps({ req, res }) {
  res.setHeader('Cache-Control', 'private, no-store');
  const auth = await requireServerUser(req, res);
  if (!auth.user?.email_confirmed_at) return { redirect: { destination: '/signin?next=%2Fresults', permanent: false } };
  return { props: {} };
}
const money = n => Number.isSafeInteger(n) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100) : '—';
const percent = n => n === null || n === undefined ? '—' : (n*100).toFixed(1)+'%';
const stamp = n => n && Number.isFinite(Date.parse(n)) ? new Date(n).toLocaleString() : 'Not reported';
const odds = n => Number.isFinite(n) ? (n>0?'+':'')+n : '—';
const prompts = ['What sportsbooks am I losing with the most?', 'What markets are we crushing?', 'Which leagues have the best ROI?'];
function Breakdown({title,rows}) {
  return <section className={styles.card}><h2>{title}</h2>{!rows?.length?<p>No settled results to compare yet.</p>:<div className={styles.scroll}><table><thead><tr><th>Group</th><th>Settled / measured</th><th>Net result</th><th>ROI</th></tr></thead><tbody>{[...rows].sort((a,b)=>(b.netProfitCents??-Infinity)-(a.netProfitCents??-Infinity)).map(r=><tr key={r.name}><td>{r.name}</td><td>{r.settled} / {r.known}</td><td className={r.netProfitCents<0?styles.loss:styles.gain}>{money(r.netProfitCents)}</td><td>{percent(r.roi)}</td></tr>)}</tbody></table></div>}</section>;
}
function Receipt({slip:s}) {
  return <details className={styles.receipt}><summary>View bet slip</summary><dl><dt>Sportsbook reference</dt><dd>{s.bookReference||'Not reported'}</dd><dt>Provider slip</dt><dd>{s.id}</dd><dt>Type / odds</dt><dd>{s.type} · {odds(s.oddsAmerican)}</dd><dt>Original potential profit</dt><dd>{money(s.toWinCents)}</dd><dt>Adjusted stake</dt><dd>{money(s.adjustedStakeCents)}</dd><dt>Settled</dt><dd>{s.closedAt?stamp(s.closedAt):s.closedDate||'Not reported'}</dd></dl><ol>{s.legs?.map((l,i)=><li key={l.id||i}><strong>{l.description||'Selection unavailable'}</strong><span>{l.event}</span><span>{l.position}{l.line!==null&&l.line!==undefined?' · Line '+l.line:''} · {odds(l.oddsAmerican)} · {l.outcome||l.status||'Unknown'}</span>{l.incomplete&&<span>Some details unavailable</span>}</li>)}</ol><small>Imported provider record. Potential profit is not the settled payout.</small></details>;
}
export default function Results() {
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false),[linkUrl,setLinkUrl]=useState(''),[notice,setNotice]=useState('');
  const [filters,setFilters]=useState({book:'',market:'',from:'',to:''}),[applied,setApplied]=useState({});
  const [question,setQuestion]=useState(''),[answer,setAnswer]=useState(null),[asking,setAsking]=useState(false),[askError,setAskError]=useState('');
  const [status,setStatus]=useState('all');
  const live=data?.mode==='live';
  async function request(body, params={}) {
    const r=await fetch('/api/sportsbook-results?'+new URLSearchParams(params),{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    const value=await r.json(); if(!r.ok) {if(r.status===401){setData(null);setAnswer(null);setLinkUrl('');setConsent(false);}throw Error(value.error||value.message||'Results unavailable.');} return value;
  }
  async function load(next=filters) {
    setBusy(true);setError('');setData(null);setAnswer(null);setAskError('');setLinkUrl('');
    try {const cfg=await request(null,{view:'configuration'});setData(cfg);if(cfg.configured)setData(await request(null,next));setApplied({...next});}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  useEffect(()=>{load({book:'',market:'',from:'',to:''});},[]);
  async function connect() {
    setBusy(true);setError('');setLinkUrl('');
    try {
      const session=await request({action:'link',consent});
      if(!document.getElementById('sharpsports-extension')) {
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');script.id='sharpsports-extension';script.src='https://d1vhnbpkpweicq.cloudfront.net/extension-cdn.js';
          script.setAttribute('internalId',session.internalId);script.setAttribute('publicKey',session.publicKey);script.setAttribute('extensionAuthToken',session.extensionAuthToken);
          const timer=setTimeout(()=>{script.remove();reject(Error('Connection helper timed out. Please reload.'));},15000);
          script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Connection helper could not load.'));};document.body.appendChild(script);
        });
      } else {window.internalId=session.internalId;window.publicKey=session.publicKey;window.extensionAuthToken=session.extensionAuthToken;}
      setLinkUrl(session.linkUrl);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function disconnect(accountId) {
    setBusy(true);setError('');setAnswer(null);setData(null);
    try {await request({action:'disconnect',accountId});setNotice('Provider account access removed.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function ask(text=question) {
    setAsking(true);setAskError('');setAnswer(null);setQuestion(text);
    try{setAnswer(await request({action:'ask',question:text,filters:applied}));}catch(e){setAskError(e.message);}finally{setAsking(false);}
  }
  const totals=data?.analytics?.total;
  const shown=(data?.slips||[]).filter(s=>status==='all'||(status==='open'?s.status==='pending':s.status==='completed'));
  return <main className={styles.page}>
    <nav className={styles.nav}><Link href='/dashboard'>← Workspace</Link><Link href='/bets'>Manual & Telegram ledger</Link></nav>
    <header className={styles.header}><div><span className={styles.eyebrow}>YOUR BETTING HISTORY</span><h1>Every book. One view.</h1><p>Your bet slips, your results, and answers grounded in the numbers.</p></div><span className={styles.badge}>{live?'Live · private pilot':'Sandbox · test data only'}</span></header>
    {error&&<div role='alert' className={styles.warning}>{error} <button disabled={busy||asking} onClick={()=>load()}>Retry</button></div>}
    <section className={styles.card}><div className={styles.sectionTitle}><div><h2>Connected sportsbooks</h2><p>FanDuel, DraftKings, BetMGM and Caesars · availability varies by region.</p></div><button disabled={busy||asking} onClick={()=>load()}>{busy?'Loading…':'Reload history'}</button></div>
      {!data&&!error&&<p role='status'>Checking your connections…</p>}
      {data?.configured===false&&<div className={styles.warning}><strong>{live?'Live setup is pending.':'Sandbox setup is pending.'}</strong><p>{data.message} Account linking will appear here when provider setup is complete.</p></div>}
      {data?.configured&&<><div className={styles.accounts}>{data.accounts?.map(a=><article key={a.id}><strong>{a.book}</strong><span>{a.paused?'Paused':a.verified?'Connected':'Needs reconnection'}</span><small>Sync requested: {stamp(a.lastRefresh)}</small><button disabled={busy||asking} onClick={()=>disconnect(a.id)}>Disconnect</button></article>)}{data.accounts?.length===0&&<p>No accounts connected yet. Start with FanDuel below.</p>}</div>
        <label className={styles.consent}><input type='checkbox' checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);setLinkUrl('');}}/><span>I agree to share {live?'my sportsbook':'sandbox'} history with SharpSports and Sharp Signals for results tracking. {live?'Enter credentials only on the provider’s connection screen.':'I will use test credentials only.'}</span></label>
        <div className={styles.actions}><button className={styles.primary} disabled={busy||asking||!consent} onClick={connect}>Connect a sportsbook</button>{linkUrl&&consent&&<a className={styles.primary} href={linkUrl} target='_blank' rel='noopener noreferrer'>Continue to {live?'sportsbook':'sandbox'} login ↗</a>}</div>
        {!live&&<p className={styles.muted}>Sandbox login: gooduser / Test1. Do not use your real FanDuel credentials in sandbox.</p>}
      </>}
      <p className={styles.muted}>FanDuel linking requires desktop Chrome and the SharpSports extension. Return here and reload after linking. Reload reads saved provider history; it does not request a sportsbook sync.</p><p role='status'>{notice}</p>
    </section>
    {data?.slips&&<>
      <form className={styles.filters} onSubmit={e=>{e.preventDefault();load();}}>{['book','market'].map(field=><label key={field} htmlFor={"filter-"+field}>{field==='book'?'Sportsbook':'Market'}<select aria-label={field==='book'?'Sportsbook':'Market'} id={"filter-"+field} value={filters[field]} onChange={e=>setFilters({...filters,[field]:e.target.value})}><option value=''>All {field==='book'?'sportsbooks':'markets'}</option>{data.options?.[field==='book'?'books':'markets']?.map(v=><option key={v}>{v}</option>)}</select></label>)}{['from','to'].map(field=><label key={field}>Placed {field} (UTC)<input type='date' value={filters[field]} onChange={e=>setFilters({...filters,[field]:e.target.value})}/></label>)}<button disabled={busy||asking}>Apply filters</button></form>
      {data.limited&&<div className={styles.warning}>Partial history: the first {data.pagesRead} of {data.totalPages} provider pages are shown. Every total and answer covers only these loaded slips.</div>}
      <div className={styles.metrics}>{[['Net result',money(totals?.netProfitCents),'Reported settled profit'],['ROI',percent(totals?.roi),`${totals?.roiCount||0} settled cash-stake slips`],['Open stakes',money(totals?.openStakeCents),`${totals?.openCount||0} pending slips`],['Bet slips',totals?.count??0,`${totals?.settled||0} settled · ${totals?.wins||0} wins / ${totals?.losses||0} losses`]].map(([label,value,note])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
      <p className={styles.muted}>{totals?.missingProfit||0} settled slips missing profit; {totals?.missingOpenStake||0} open slips missing stake. ROI excludes unknown and zero-stake promotions. Parlays count once, in their own market group.</p>
      <div className={styles.comparisons}><Breakdown title='By sportsbook' rows={data.analytics?.books}/><Breakdown title='By market' rows={data.analytics?.markets}/></div>
      <section className={`${styles.card} ${styles.assistant}`}><span className={styles.eyebrow}>ASK YOUR BETS</span><h2>What do you want to understand?</h2><p>Ask about sportsbook, market or league profit and ROI. Answers use the applied filters above.</p><div className={styles.prompts}>{prompts.map(p=><button key={p} disabled={asking||busy} onClick={()=>ask(p)}>{p}</button>)}</div><form onSubmit={e=>{e.preventDefault();ask();}}><label className={styles.srOnly} htmlFor='bet-question'>Question about your bets</label><input id='bet-question' maxLength={500} value={question} onChange={e=>setQuestion(e.target.value)} placeholder='Which sportsbook has my lowest net result?'/><button className={styles.primary} disabled={asking||busy||!question.trim()}>{asking?'Checking…':'Ask'}</button></form><small>AI interprets your question; code calculates the results. Only your question is sent to the AI service.</small>{askError&&<p role='alert'>{askError} The performance tables are still available.</p>}{answer&&<div aria-live='polite' className={styles.answer}><p>{answer.text}</p><small>{answer.mode==='sandbox'?'Test data. ':''}{answer.sampleCount} imported slips in scope. {answer.limited?'Partial history. ':''}Open wagers are excluded from profit and ROI.</small>{answer.rows?.length>0&&<Breakdown title='Supporting results' rows={answer.rows}/>}</div>}</section>
      <section className={styles.card}><div className={styles.sectionTitle}><div><h2>Bet slips</h2><p>{shown.length} slips · Retrieved {stamp(data.fetchedAt)}</p></div><label>Show <select value={status} onChange={e=>setStatus(e.target.value)}><option value='all'>All slips</option><option value='open'>Open</option><option value='settled'>Settled</option></select></label></div>{!shown.length?<div className={styles.empty}><h3>No bet slips in this view</h3><p>Connect an account or widen the filters to see its imported history.</p></div>:<div className={styles.scroll}><table><thead><tr><th>Sportsbook / selection</th><th>Placed</th><th>Stake</th><th>Result</th><th>Net result</th></tr></thead><tbody>{shown.map(s=><tr key={s.id}><td><strong>{s.book}</strong><span className={styles.description}>{s.description}</span><small>{s.market}{s.incomplete?' · Some details unavailable':''}</small><Receipt slip={s}/></td><td>{stamp(s.placedAt)}</td><td>{money(s.adjustedStakeCents??s.stakeCents)}</td><td>{s.outcome||s.status}</td><td className={s.netProfitCents<0?styles.loss:styles.gain}>{money(s.netProfitCents)}</td></tr>)}</tbody></table></div>}</section>
    </>}
  </main>;
}
