const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const schema='prediction_probability_timeline_v1';
function sample(row,now,release){
 const live=row.live,p=live?.probability;
 if(!/^live_[a-f0-9]{64}$/.test(row.id)||!Number.isFinite(now))throw Error('invalid_recording_identity');
 const observed=Date.parse(live?.checked_at),at=Date.parse(p?.as_of);
 const valid=live?.state==='in'&&Number.isFinite(observed)&&now-observed>=0&&now-observed<=90000&&Number.isFinite(at)&&now-at>=-5000&&now-at<=180000&&p&&[p.win,p.lose,p.tie??0,p.push??0].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)&&Math.abs(p.win+p.lose+(p.tie??0)+(p.push??0)-1)<1e-6;
 return {id:hash([row.id,Math.floor(now/60000)]),recorded_at:new Date(now).toISOString(),minute:Math.floor(now/60000),
  state:live?.state||'unavailable',status:live?.status||'Fresh exact-game state unavailable',event_id:live?.event_id||null,
  official_start:live?.official_start||null,home_score:live?.home_score??null,away_score:live?.away_score??null,
  period:live?.period??null,clock:live?.clock??null,checked_at:live?.checked_at||null,
  win:valid?p.win:null,lose:valid?p.lose:null,tie:valid?(p.tie??0):null,push:valid?(p.push??0):null,
  source:valid?p.source:null,model:valid?(p.model||'ESPN game-win model'):null,experimental:valid?p.experimental===true:null,
  probability_as_of:valid?p.as_of:null,gap:valid?null:live?.state==='pre'?'pregame':live?.state==='post'?'game_finished':'fresh_probability_unavailable',recorder_release:release};
}
function append(history,point){
 if(history.points.some(p=>p.minute===point.minute))return history;
 if(history.points.length>=2160)throw Error('probability_history_capacity_no_data_removed');
 if(history.points.length&&Date.parse(point.recorded_at)<Date.parse(history.points.at(-1).recorded_at))throw Error('recording_clock_regression');
 return {...history,updated_at:point.recorded_at,points:[...history.points,point]};
}
module.exports={sample,append,schema};
