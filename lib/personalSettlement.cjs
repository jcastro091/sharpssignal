const crypto=require('node:crypto');
const {normalizeTeamName:norm}=require('./scoreTeamIdentity.cjs');
const startMs=v=>typeof v==='number'?v*1000:Date.parse(v);
function selectionHash(row){const p=row.snapshot||{};return crypto.createHash('sha256').update(JSON.stringify([row.id,row.play_key,p.entry_id,p.sport,p.event,p.home,p.away,p.market,p.side,p.point??p.line??null,p.start,row.sportsbook,row.odds_american,row.stake_cents,Number.isFinite(Date.parse(row.created_at))?new Date(row.created_at).toISOString():null])).digest('hex');}
function personalSettlement(row,score,{now=Date.now()}={}){
 const p=row.snapshot||{},at=Date.parse(score?.checked_at),start=Date.parse(score?.official_start),created=Date.parse(row.created_at);
 if(!Number.isFinite(now)||!p.entry_id||JSON.stringify([p.cohort,p.play_key,p.line??p.point??null])!==row.play_key||
   score?.source!=='ESPN'||score.sport!==p.sport||score.state!=='post'||score.completed!==true||score.final_status!=='STATUS_FINAL'||
   !/^\d+$/.test(score.event_id||'')||!/^\d+$/.test(score.home_team_id||'')||!/^\d+$/.test(score.away_team_id||'')||score.home_team_id===score.away_team_id||
   norm(score.home)!==norm(p.home)||norm(score.away)!==norm(p.away)||
   !Number.isFinite(start)||!Number.isFinite(created)||created>=start||!Number.isFinite(startMs(p.start))||Math.abs(start-startMs(p.start))>1800000||
   !Number.isFinite(at)||at<start||at>now+5000||now-at>120000||
   !Number.isInteger(score.home_score)||score.home_score<0||!Number.isInteger(score.away_score)||score.away_score<0||
   (score.home_score===score.away_score&&p.sport!=='americanfootball_nfl')||
   !Number.isInteger(row.stake_cents)||row.stake_cents<=0||!Number.isInteger(row.odds_american)||Math.abs(row.odds_american)<100)return null;
 let margin;const home=norm(p.side)===norm(p.home),away=norm(p.side)===norm(p.away),point=p.point??p.line;
 if(p.market==='h2h'){
  if(!home&&!away)return null;
  margin=(score.home_score-score.away_score)*(home?1:-1);
  if(margin===0&&p.sport!=='americanfootball_nfl')return null;
 }else if(p.market==='spreads'||p.market==='totals'){
  if(typeof point!=='number'||!Number.isFinite(point)||!Number.isInteger(point*2))return null;
  if(p.market==='spreads'){
   if(!home&&!away)return null;
   margin=(score.home_score-score.away_score)*(home?1:-1)+point;
  }else{
   if(point<0||!['Over','Under'].includes(p.side))return null;
   margin=(score.home_score+score.away_score-point)*(p.side==='Over'?1:-1);
  }
 }else return null;
 const result=margin>0?'win':margin<0?'loss':'push';
 const pnl=result==='loss'?-row.stake_cents:result==='push'?0:Math.round(row.stake_cents*(row.odds_american>0?row.odds_american/100:100/Math.abs(row.odds_american)));
 return {version:1,selection_hash:selectionHash(row),result,pnl_cents:pnl,graded_at:new Date(now).toISOString(),evidence:Object.fromEntries(['source','sport','official_start','completed','final_status','event_id','home_team_id','away_team_id','state','home','away','home_score','away_score','checked_at','url'].map(k=>[k,score[k]]))};
}
function savedPersonalSettlement(row){const s=row.settlement;if(s?.version!==1||s.selection_hash!==selectionHash(row))return null;const checked=personalSettlement(row,s.evidence,{now:Date.parse(s.graded_at)});return checked&&checked.result===s.result&&checked.pnl_cents===s.pnl_cents?checked:null;}
module.exports={selectionHash,personalSettlement,savedPersonalSettlement};
