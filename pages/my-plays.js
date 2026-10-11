import Head from 'next/head';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {getServerUser} from '../lib/authServer';
import {marketLabel} from '../lib/marketDisplay.cjs';
import {formatAmerican} from '../lib/oddsDisplay.cjs';
import styles from '../styles/tracked.module.css';

export async function getServerSideProps({req,res}) {
  res.setHeader('Cache-Control','private, no-store');const user=await getServerUser(req,res);
  if(!user?.email_confirmed_at)return {redirect:{destination:'/signin?next=%2Fmy-plays',permanent:false}};
  return {props:{}};
}
const money=value=>value==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
const pct=value=>value==null?'—':(value*100).toFixed(1)+'%';
export default function MyPlays() {
  const [data,setData]=useState(null),[filters,setFilters]=useState({book:'',market:'',status:''}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[asking,setAsking]=useState(false);
  useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setAnswer('');
    fetch('/api/tracked-plays?'+new URLSearchParams(filters),{signal:controller.signal,cache:'no-store'}).then(async response=>{const json=await response.json();if(!response.ok||!json.ok)throw Error(json.error||'Could not load your plays.');if(active)setData(json);}).catch(error=>{if(active){setData(null);setError(error.message);}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[filters,refresh]);
  async function ask(event){event.preventDefault();setAsking(true);setAnswer('');try{const response=await fetch('/api/tracked-plays',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ask',question,filters})});const json=await response.json();if(!response.ok)throw Error(json.error);setAnswer(json.answer);}catch(error){setAnswer(error.message||'Please try again.');}finally{setAsking(false);}}
  const summary=data?.summary;
  return <main className={styles.page}><Head><title>My plays · Sharp Signals</title></Head>
    <div className={styles.top}><Link href="/dashboard">← Sports dashboard</Link><Link href="/bets">Telegram ledger</Link></div>
    <header className={styles.header}><div><span className="eyebrow">YOUR PERSONAL TRACK RECORD</span><h1>My plays<span>.</span></h1><p>Every pick you tail, in one place. See your results by sportsbook and market.</p></div><button className="button-secondary" onClick={()=>setRefresh(x=>x+1)} disabled={loading||asking}>{loading?'Refreshing…':'Refresh results'}</button></header>
    <p className={styles.notice}>User-recorded plays · No sportsbook connection or automatic wagers. Grades follow matching released results with a minimum 30-minute delay.</p>
    <section className={styles.filters} aria-label="Filter tracked plays">{[['book','Sportsbook',data?.options.books||[]],['market','Market',data?.options.markets||[]],['status','Status',['pending','settled']]].map(([key,label,options])=><label key={key}>{label}<select value={filters[key]} disabled={asking} onChange={event=>setFilters({...filters,[key]:event.target.value})}><option value="">All {label.toLowerCase()}s</option>{options.map(value=><option key={value} value={value}>{key==='market'?marketLabel(value):value}</option>)}</select></label>)}</section>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{data?.partial&&<p role="status">Showing your latest 1,000 tracked plays. Totals and insights cover only this history.</p>}{data?.publishing_paused&&<p role="status">Result publication is paused. Plays remain saved; grading is temporarily unavailable.</p>}
    <section className={styles.metrics} aria-label="Your performance">{[['Tracked plays',summary?.total],['Open plays',summary?.pending],['Record',summary?`${summary.wins}–${summary.losses}–${summary.pushes}`:null],['Net profit',money(summary?.pnl_cents)],['Settled ROI',pct(summary?.roi)],['Open stake',money(summary?.open_stake_cents)]].map(([label,value])=><article key={label}><small>{label}</small><strong>{loading?'…':value??'—'}</strong></article>)}</section>
    {!loading&&data?.rows.length===0&&<section className={styles.empty}><span className="eyebrow">YOUR TRACK RECORD STARTS HERE</span><h2>{data?.options.books.length?'No plays match these filters.':'Your first tail starts your dashboard.'}</h2><p>Open an upcoming pick on the sports dashboard, choose “Tail this pick”, and confirm your sportsbook, odds and stake.</p><Link href="/dashboard" className="button-primary">Browse picks →</Link></section>}
    <div className={styles.two}><Breakdown title="By sportsbook" rows={data?.books}/><Breakdown title="By market" rows={data?.markets} market/></div>
    <section className={styles.panel}><span className="eyebrow">QUICK INSIGHTS</span><h2>Ask about your results</h2><p className="muted">Answers calculate profit and ROI from the plays in your current view.</p><div className={styles.prompts}>{['What sportsbooks am I losing with the most?','What markets are we crushing?'].map(text=><button key={text} className="button-secondary" disabled={asking} onClick={()=>setQuestion(text)}>{text}</button>)}</div><form onSubmit={ask} className={styles.ask}><label className={styles.question}>Your question<input value={question} maxLength={500} required placeholder="Which market has the best ROI?" onChange={event=>setQuestion(event.target.value)}/></label><button className="button-primary" disabled={asking||loading||!data}>{asking?'Checking…':'Ask'}</button></form>{answer&&<p role="status" className={styles.answer}>{answer}</p>}</section>
    <section className={styles.panel}><div className={styles.top}><h2>Your bet slips</h2><span className="muted">{data?.rows.length??0} plays</span></div><div className={styles.slips}>{data?.rows.map(row=><details key={row.id} className={styles.slip}><summary><span><strong>{row.play.side} {row.play.point??row.play.line??''}</strong><small>{row.play.away} @ {row.play.home} · {marketLabel(row.play.market)}</small></span><span className={styles.result}>{row.result}<strong>{money(row.pnl_cents)}</strong></span></summary><dl><div><dt>Sportsbook</dt><dd>{row.sportsbook}</dd></div><div><dt>Your odds</dt><dd>{formatAmerican(row.odds)}</dd></div><div><dt>Your stake</dt><dd>{money(row.stake_cents)}</dd></div><div><dt>Tracked</dt><dd>{new Date(row.created_at).toLocaleString()}</dd></div></dl><p className="small muted">Self-reported play. Result is matched to the original selection and line; this is not a sportsbook receipt.</p></details>)}</div></section>
  </main>;
}
function Breakdown({title,rows,market}) {return <section className={styles.panel}><h2>{title}</h2>{!rows?.length?<p className="muted">Your breakdown will appear after you track a play.</p>:<div className={styles.table}><table><thead><tr><th>{market?'Market':'Sportsbook'}</th><th>W–L–P</th><th>Profit</th><th>ROI</th></tr></thead><tbody>{rows.map(row=><tr key={row.name}><td>{market?marketLabel(row.name):row.name}<small>{row.pending} open</small></td><td>{row.wins}–{row.losses}–{row.pushes}</td><td>{money(row.pnl_cents)}</td><td>{pct(row.roi)}</td></tr>)}</tbody></table></div>}</section>;}
