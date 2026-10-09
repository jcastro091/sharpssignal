import {formatMarketPrice} from '../lib/marketPriceDisplay.cjs';
import {decimalToAmericanLabel} from '../lib/oddsDisplay.cjs';
import {sportsbookName} from '../lib/sportsbookDisplay.cjs';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {requireServerUser} from '../lib/authServer';

export async function getServerSideProps({req,res}){
 res.setHeader('Cache-Control','private, no-store');
 const auth=await requireServerUser(req,res);
 if(!auth.user?.email_confirmed_at)return {redirect:{destination:'/signin?next=%2Falerts',permanent:false}};
 const interests=Array.isArray(auth.user.user_metadata?.interests)?auth.user.user_metadata.interests.filter(x=>['sports','markets'].includes(x)):['sports','markets'];
 return {props:{interests}};
}
const stamp=value=>{
 if(value==null)return 'Not available';
 const date=new Date(typeof value==='number'?value*1000:value);
 return Number.isFinite(date.getTime())?date.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Not available';
};
const human=value=>String(value||'Pending').replaceAll('_',' ');

export default function Alerts({interests}){
 const [feeds,setFeeds]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setFeeds(null);setError('');
  Promise.all(interests.map(async section=>{const response=await fetch('/api/member-feed?section='+section,{signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Alert feed unavailable');return {...data,section};})).then(data=>{if(!controller.signal.aborted)setFeeds(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[interests,refresh]);
 return <main className="member-shell alerts-shell"><div className="member-content alerts-content">
  <div className="member-top"><Link className="alerts-back" href="/dashboard">← Back to dashboard</Link><button className="button-secondary" onClick={()=>setRefresh(value=>value+1)}>Refresh</button></div>
  <header className="alerts-heading"><span className="eyebrow">YOUR ALERTS</span><h1>Your signal inbox.</h1><p className="muted">Released sports picks and market trades, together in one place.</p></header>
  <div className="alerts-delivery"><div><b>Paper research · captured prices</b><p>Free updates arrive after a minimum 30-minute delay. Prices may have changed since capture.</p></div><Link className="button-secondary" href="/billing">Telegram setup →</Link></div>
  {error?<div role="alert" className="error-message">{error}. Refresh to try again.</div>:!feeds?<p className="alerts-loading" role="status">Loading alerts…</p>:feeds.map(feed=>{
   const sports=feed.section==='sports';
   return <section className="member-panel alerts-panel" key={feed.section} aria-labelledby={'alerts-'+feed.section}>
    <div className="panel-title"><div className="alerts-section-title"><h2 id={'alerts-'+feed.section}>{sports?'Sports':'Markets'}</h2><span className="alerts-count">{feed.plays.length} records</span></div><span className="status-pill">{feed.feed_mode==='realtime'?'Real-time access':'Free · minimum 30-minute delay'}</span></div>
    {feed.publishing_paused&&<p className="small muted">Publishing paused.</p>}
    {!feed.plays.length?<div className="alerts-empty"><h3>{feed.publishing_paused?'No alerts while publishing is paused':'No released alerts yet'}</h3><p>New entries and updates appear here after their release delay.</p></div>:<div className="alerts-list">{feed.plays.map(play=><article className="inbox-record" key={JSON.stringify([play.cohort,play.entry_id||play.trade_id,play.point])}>
     <div className="inbox-selection"><h3>{sports?play.side:play.symbol}{sports&&play.point!=null?' '+play.point:''}</h3><p>{sports?<>{play.away} @ {play.home}</>:play.direction>0?'Long':play.direction<0?'Short':'Direction unavailable'}{sports&&play.market?' · '+human(play.market):''}</p></div>
     <div className="inbox-price"><small>{sports?'Captured odds':'Captured entry'}</small><b>{sports?decimalToAmericanLabel(play.decimal):formatMarketPrice(play.entry_price)}</b><p>{sports?sportsbookName(play.book):'Stop '+formatMarketPrice(play.stop)+' · Target '+formatMarketPrice(play.target)}</p></div>
     <div className="inbox-result"><small>{sports?'Paper result':'Trade status'}</small><span className="status-pill">{human(sports?play.result:play.status)}</span></div>
     <div className="inbox-time"><small>Recorded</small><time>{stamp(play.entry_at??play.entry_time)}</time>{sports&&<p>Game: {stamp(play.start)}</p>}</div>
    </article>)}</div>}
   </section>;
  })}
 </div></main>;
}
