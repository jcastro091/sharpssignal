import Head from 'next/head';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {getServerUser} from '../lib/authServer';
import styles from '../styles/sports.module.css';

export function sportsTime(value) {
  if(!value) return 'Time unavailable';
  const date=new Date(typeof value==='number'&&value<1e12?value*1000:value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date):'Time unavailable';
}
export default function Sports({signedIn}) {
  const [feed,setFeed]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!signedIn) return;
    const controller=new AbortController();setError('');setFeed(null);
    fetch('/api/member-feed?section=sports',{cache:'no-store',signal:controller.signal}).then(async r=>{
      const data=await r.json();if(!r.ok||data.ok===false) throw new Error(data.error||'Sports research is temporarily unavailable.');
      setFeed(data);
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>controller.abort();
  },[signedIn,attempt]);
  const plays=Array.isArray(feed?.plays)?feed.plays:[];
  return <main className={styles.page}>
    <Head><title>Sports research | SharpsSignal</title><meta name="description" content="Follow free sports research: recorded selections, captured prices, game times and paper results."/></Head>
    <p className={styles.eyebrow}>SHARPSSIGNAL · SPORTS</p>
    <h1>Follow the research. See the record.</h1>
    <p className={styles.intro}>Recorded sports selections, the price captured at entry, and the result when settled. This is paper research; performance is still being evaluated.</p>
    {!signedIn?<>
      <ol className={styles.steps}><li><strong>Create a free account</strong><span>Choose Sports on the signup form.</span></li><li><strong>Confirm your email</strong><span>Open the confirmation link to activate your account.</span></li><li><strong>Read the sports feed</strong><span>Review published selections and their paper results here.</span></li></ol>
      <Link className={styles.button} href="/signup?next=%2Fsports&interest=sports">Follow sports free</Link>
      <p>Already registered? <Link href="/signin?next=%2Fsports">Sign in to Sports</Link></p>
      <section className={styles.guide}><h2>What each card tells you</h2><dl><div><dt>Selection</dt><dd>The side or total recorded for the game.</dd></div><div><dt>Captured price</dt><dd>Decimal odds and the sportsbook at the time of entry.</dd></div><div><dt>Game time</dt><dd>U.S. date format, shown in Eastern Time.</dd></div><div><dt>Paper result</dt><dd>Pending until settlement; then the recorded outcome.</dd></div></dl></section>
    </>:<>
      <div className={styles.notice}><strong>Your free sports feed</strong><span>Published research appears below. Paid alerts are optional.</span></div>
      <section aria-live="polite" aria-busy={!feed&&!error}>
        {!feed&&!error&&<p>Loading your sports research…</p>}
        {error&&<div className={styles.guide}><p>{error}</p><button className={styles.button} onClick={()=>setAttempt(x=>x+1)}>Try again</button><p><Link href="/signin?next=%2Fsports">Sign in again</Link></p></div>}
        {feed&&<><p className={styles.updated}>Feed updated: {sportsTime(feed.observed_at)}{['stale','unavailable'].includes(feed.status)?' · Update delayed':''}</p>
          {!plays.length&&<div className={styles.guide}><h2>No published selections yet</h2><p>Check back when new research is published. An empty feed does not mean a missed bet.</p></div>}
          <div className={styles.cards}>{plays.map((p,i)=><article className={styles.card} key={p.entry_id||p.play_key||i}>
            <p className={styles.eyebrow}>{p.sport||'Sports'} · {p.market||'Selection'}</p>
            <h2>{p.away&&p.home?`${p.away} at ${p.home}`:p.event||'Recorded game'}</h2>
            <dl><div><dt>Selection</dt><dd>{p.side||'Unavailable'} {p.point??p.line??''}</dd></div><div><dt>Captured price</dt><dd>{Number.isFinite(Number(p.decimal))&&p.decimal?Number(p.decimal).toFixed(2):'Unavailable'}{p.book?` · ${p.book}`:''}</dd></div><div><dt>Game time</dt><dd>{sportsTime(p.start)}</dd></div><div><dt>Paper result</dt><dd>{p.result||'Pending settlement'}</dd></div></dl>
            <p className={styles.updated}>Recorded: {sportsTime(p.entry_at)}</p>
          </article>)}</div></>}
      </section>
    </>}
    <p className={styles.disclaimer}>Research is informational. Paper results are not live betting returns, and no outcome is guaranteed.</p>
  </main>;
}
export async function getServerSideProps({req,res}) {
  res.setHeader('Cache-Control','private, no-store');
  const user=await getServerUser(req,res);
  return {props:{signedIn:!!user?.email_confirmed_at}};
}
