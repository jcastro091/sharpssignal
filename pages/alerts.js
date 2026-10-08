import {useEffect,useState} from 'react';
import Link from 'next/link';
import {requireServerUser} from '../lib/authServer';
export async function getServerSideProps({req,res}){
 const auth=await requireServerUser(req,res);
 if(!auth.user?.email_confirmed_at)return {redirect:{destination:'/signin?next=%2Falerts',permanent:false}};
 const interests=Array.isArray(auth.user.user_metadata?.interests)?auth.user.user_metadata.interests.filter(x=>['sports','markets'].includes(x)):['sports','markets'];
 return {props:{interests}};
}
const stamp=value=>new Date(typeof value==='number'?value*1000:value).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
export default function Alerts({interests}){
 const [feeds,setFeeds]=useState(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();
  Promise.all(interests.map(async section=>{const response=await fetch('/api/member-feed?section='+section,{signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Alert feed unavailable');return {section,...data};})).then(setFeeds).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[interests]);
 return <main className="member-shell"><div className="member-content"><span className="eyebrow">YOUR ALERTS</span><h1>Your signal inbox.</h1>
  <p>All released paper plays and trades appear here. Free updates arrive after a minimum 30-minute delay. <Link href="/billing">Connect paid Telegram for real-time alerts.</Link></p>
  {error?<p role="alert">{error}</p>:!feeds?<p role="status">Loading alerts…</p>:feeds.map(feed=><section className="member-panel" key={feed.section}><h2>{feed.section==='sports'?'Sports':'Markets'}</h2><p>{feed.feed_mode==='realtime'?'Real-time access':'Free · minimum 30-minute delay'}</p>
   {!feed.plays.length?<p>No released plays yet. New entries and updates appear after their delay.</p>:feed.plays.map(play=><article key={JSON.stringify([play.cohort,play.entry_id||play.trade_id,play.point])} style={{padding:'16px 0',borderBottom:'1px solid #334155'}}>
    <h3>{play.side||play.symbol}{play.point!=null?' '+play.point:''}</h3><p>{play.away?play.away+' @ '+play.home:play.direction>0?'Long':'Short'} · {play.arm||play.family} · {play.cohort||'Forward research'}</p>
    <p>{play.decimal?'Recorded decimal odds '+play.decimal:'Entry '+play.entry_price} · {String(play.result||play.status||'Pending').replaceAll('_',' ')}</p><small>{stamp(play.entry_at||play.entry_time)} · Paper research</small>
   </article>)}
  </section>)}<Link href="/dashboard">Back to dashboard</Link></div></main>;
}
