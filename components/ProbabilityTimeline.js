import {useEffect,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,CartesianGrid,Legend} from 'recharts';
import styles from '../styles/tracked.module.css';
const when=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Not recorded';
export default function ProbabilityTimeline({row}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!open||!row.id.startsWith('live_'))return;let active=true;const controller=new AbortController();
  async function refresh(){try{const reply=await fetch('/api/probability-timeline?'+new URLSearchParams({record:row.id.slice(5)}),{cache:'no-store',signal:controller.signal});if(!reply.ok)throw Error();const json=await reply.json();if(active){setData(json);setFailed(false);}}catch{if(active)setFailed(true);}}
  refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[open,row.id]);
 const points=data?.points||[],valid=points.filter(p=>p.win!=null);
 const plotted=points.map(p=>({at:Date.parse(p.recorded_at),espn:p.win!=null&&!p.experimental?p.win*100:null,own:p.win!=null&&p.experimental?p.win*100:null}));
 return <details className={styles.timeline} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Win probability timeline</summary>
 <p className="small muted">Recorded every minute by AWS, including while this page is closed. ESPN and our experimental, uncalibrated model are separate sources. Missing or stale estimates remain gaps.</p>
 {failed||data?.source_status==='unavailable'?<p role="status">Probability history is temporarily unavailable. Saved bets and results are unchanged.</p>:!data?<p>Loading recorded estimates…</p>:<>
 <p className="small">Recording began {when(data.recording_started_at)}. Earlier percentages were not reconstructed. Recorder {data.recorder_status||'unknown'} · {data.recorder_health||'Health unknown'} · Last check {when(data.recorder_checked_at)}.</p>
 {data.recorder_status!=='current'&&<p role="status">Recording is stale or not yet verified. These are historical samples.</p>}
 {data.recorder_health&&data.recorder_health!=='healthy'&&<p role="status">The recorder reports a collection problem. Previously saved samples remain available.</p>}
 {valid.length?<div className={styles.timelineChart} role="img" aria-label={`Recorded win probabilities for ${row.play.side}. Values also appear in the table below.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={plotted} margin={{top:8,right:12,bottom:8,left:0}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="at" domain={['dataMin','dataMax']} tickFormatter={t=>new Date(t).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})}/><YAxis domain={[0,100]} tickFormatter={n=>`${n}%`} width={42}/><Tooltip labelFormatter={t=>when(t)} formatter={(v,name)=>[`${Number(v).toFixed(1)}%`,name]}/><Legend/><Line dataKey="espn" name="ESPN" stroke="#2169c7" connectNulls={false} isAnimationActive={false} dot={{r:2}}/><Line dataKey="own" name="Experimental model" stroke="#b45b12" connectNulls={false} isAnimationActive={false} dot={{r:2}}/></LineChart></ResponsiveContainer></div>:<p>{row.result!=='pending'?'No probability history was captured for this bet.':'No fresh in-game probability recorded yet. Pregame and unavailable feeds do not receive invented percentages.'}</p>}
 {points.length>0&&<details><summary>View recorded samples ({points.length})</summary><div className={styles.timelineTable}><table><thead><tr><th>Recorded (Eastern)</th><th>Win chance</th><th>Source / status</th></tr></thead><tbody>{points.map(p=><tr key={p.id}><td>{when(p.recorded_at)}</td><td>{p.win==null?'Unavailable':`${(p.win*100).toFixed(1)}%`}</td><td>{p.win==null?p.state==='pre'?'Pregame':p.state==='post'?'Game finished':'Fresh estimate unavailable':p.experimental?`${p.model} (experimental)`:p.source}</td></tr>)}</tbody></table></div></details>}
 </>}
 </details>;
}
