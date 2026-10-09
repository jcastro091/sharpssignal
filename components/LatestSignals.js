import {decimalToAmericanLabel} from '../lib/oddsDisplay.cjs';
import {formatMarketPrice} from '../lib/marketPriceDisplay.cjs';

const stamp=value=>{
  if(value==null)return 'Not available';
  const date=new Date(typeof value==='number'?value*1000:value);
  return Number.isFinite(date.getTime())?date.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'Not available';
};
const human=value=>String(value||'Pending').replaceAll('_',' ');
const captured=play=>new Date(typeof (play.entry_at??play.entry_time)==='number'?(play.entry_at??play.entry_time)*1000:(play.entry_at??play.entry_time)).getTime();

export default function LatestSignals({section,feed,error}) {
  const sports=section==='sports';
  const plays=[...(feed?.plays||[])].sort((a,b)=>(captured(b)||0)-(captured(a)||0)).slice(0,3);
  return <section className="latest-signals" aria-labelledby="latest-signals-title">
    <div className="panel-title"><h2 id="latest-signals-title">Latest signals</h2><span className="status-pill">Paper research</span></div>
    <p className="small muted">Latest released records. Prices are captured values, not live quotes. Check current prices before acting.</p>
    {error?<p role="status">Signals are unavailable. Please refresh to try again.</p>:!feed?<p role="status">Loading signals…</p>:!plays.length?<div className="signal-empty"><h3>{feed.publishing_paused?'Publishing paused':'No released signals yet'}</h3><p>{feed.publishing_paused?'New signals will appear when publishing resumes.':'Released signals will appear here when available. Browse the guide below to learn how to read them.'}</p></div>:<div className="latest-signal-grid">{plays.map((play,index)=><article className="latest-signal-card" key={play.entry_id||play.trade_id||index}>
      <div className="signal-card-top"><span className="eyebrow">{sports?human(play.market):play.direction>0?'Long':play.direction<0?'Short':'Direction unavailable'}</span><span className="status-pill">{human(sports?play.result:play.status)}</span></div>
      <h3>{sports?<>{play.side}{play.point!=null?' '+play.point:play.line!=null?' '+play.line:''}</>:play.symbol}</h3>
      {sports&&<p className="signal-matchup">{play.away} @ {play.home}</p>}
      <dl className="signal-levels">{sports?<><div><dt>Captured odds</dt><dd>{decimalToAmericanLabel(play.decimal)}</dd></div><div><dt>Sportsbook</dt><dd>{play.book||'Not available'}</dd></div></>:<><div><dt>Entry</dt><dd>{formatMarketPrice(play.entry_price)}</dd></div><div><dt>Stop</dt><dd>{formatMarketPrice(play.stop)}</dd></div><div><dt>Target</dt><dd>{formatMarketPrice(play.target)}</dd></div></>}</dl>
      <div className="signal-card-details"><p><span>{sports?'Game time':'Recorded'}</span><b>{stamp(sports?play.start:play.entry_time)}</b></p>{sports?<p><span>Recorded</span><b>{stamp(play.entry_at)}</b></p>:<p><span>Paper P&amp;L</span><b>{play.status==='closed'?(Number.isFinite(play.net_pnl)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(play.net_pnl):'Not available'):'Pending'}</b></p>}</div>
      <p className="signal-card-note">{sports?'Recorded paper selection; odds may have changed.':'Recorded paper trade; entry, stop and target are research levels.'}</p>
    </article>)}</div>}
  </section>;
}
