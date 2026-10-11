import {useRef,useState,useEffect,useId} from 'react';
import Link from 'next/link';
import {signalKey} from '../lib/signalChanges.cjs';
import {decimalToAmericanLabel} from '../lib/oddsDisplay.cjs';
import {sportsbookName} from '../lib/sportsbookDisplay.cjs';
import styles from '../styles/tracked.module.css';

export default function TailPick({play}) {
  const titleId=useId();
  const dialog=useRef(null), [busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const start=typeof play.start==='number'?play.start*1000:Date.parse(play.start);
  const available=play.entry_id&&play.play_key&&start>now&&!play.result;
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
    try {
      const response=await fetch('/api/tracked-plays',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'tail',pick:signalKey(play),sportsbook:form.get('sportsbook'),odds:form.get('odds'),stake:form.get('stake')})});
      const data=await response.json();if(!response.ok||!data.ok) throw Error(data.error||'Could not save this play.');
      setSaved(true);dialog.current.close();window.dispatchEvent(new Event('tracked-play-saved'));
    } catch(error) {setError(error.message);} finally {setBusy(false);}
  }
  return <div className={styles.tail}>
    {saved?<Link className="button-secondary" href="/my-plays">Tracked ✓ · My plays</Link>:<button className="button-primary" disabled={!available} onClick={()=>{setError('');dialog.current.showModal();}}>{available?'Tail this pick':'Tracking closed'}</button>}
    <dialog ref={dialog} aria-labelledby={titleId} className={styles.dialog} onCancel={event=>{if(busy)event.preventDefault();}}>
      <form onSubmit={submit}>
        <span className="eyebrow">ADD TO MY PLAYS</span><h2 id={titleId}>Tail this pick</h2>
        <h3>{play.side} {play.point??play.line??''}</h3><p>{play.away} @ {play.home}</p>
        <p className="muted">Record your own play. This does not place a wager. Keep the selection and line shown above so its result can be matched correctly.</p>
        <label>Sportsbook<input name="sportsbook" maxLength={60} required defaultValue={sportsbookName(play.book,'')} placeholder="e.g. FanDuel"/></label>
        <div className={styles.two}><label>Your American odds<input name="odds" type="number" step="1" required defaultValue={decimalToAmericanLabel(play.decimal,'')} placeholder="-110"/></label><label>Your stake ($)<input name="stake" type="number" min="0.01" max="100000" step="0.01" required placeholder="25.00"/></label></div>
        <p className="small muted">The suggested book and odds are captured values. Confirm what you actually took. Each selection is tracked once; repeat saves keep your original details.</p>
        <label className={styles.check}><input type="checkbox" required/>My play has this exact selection and line.</label>
        {error&&<p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}><button type="button" className="button-secondary" disabled={busy} onClick={()=>dialog.current.close()}>Cancel</button><button className="button-primary" disabled={busy}>{busy?'Saving…':'Save to my plays'}</button></div>
      </form>
    </dialog>
  </div>;
}
