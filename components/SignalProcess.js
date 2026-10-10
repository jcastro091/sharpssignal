import {useEffect,useRef,useState} from 'react';

const steps = [
  ['Capture data','Record market quotes and the time they were observed.'],
  ['Analyze','Evaluate the captured information against the selection criteria.'],
  ['Check the price','Review the recorded price and entry requirements.'],
  ['Release a signal','Release eligible selections with the appropriate access delay.'],
  ['Record the outcome','Grade results when evidence is available; keep pending and missing data visible.'],
];

export default function SignalProcess() {
  const root=useRef(null);
  const [run,setRun]=useState(0),[ready,setReady]=useState(false);
  useEffect(()=>{
    if(!('IntersectionObserver' in window)){setReady(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setReady(true);observer.disconnect();}},{threshold:.15});
    observer.observe(root.current);return()=>observer.disconnect();
  },[]);
  return <section ref={root} className="signal-process" aria-labelledby="signal-process-title">
    <div className="process-heading"><div><span className="eyebrow">BEHIND THE SIGNAL</span><h2 id="signal-process-title">From the first alert to the final result.</h2><p>The price, the selection and the outcome, connected.</p></div><button className="button-secondary" onClick={()=>{setReady(true);setRun(value=>value+1);}}>Replay illustration <span aria-hidden="true">↻</span></button></div>
    <ol className="process-steps" key={run} data-animate={ready||undefined}>{steps.map(([title,description],index)=><li key={title} style={{'--process-step':index}}><span className="process-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><h3>{title}</h3><p>{description}</p>{index<steps.length-1&&<span className="process-connector" aria-hidden="true"><i/></span>}</li>)}</ol>
    <p className="process-caption">Illustrated workflow. SharpsSignal tracks selections; you place any wager with your sportsbook.</p>
  </section>;
}
