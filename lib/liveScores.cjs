const {modelProbability}=require('./liveProbability.cjs');
const paths={basketball_nba:'basketball/nba',basketball_ncaab:'basketball/mens-college-basketball',basketball_wnba:'basketball/wnba',americanfootball_nfl:'football/nfl',americanfootball_ncaaf:'football/college-football',icehockey_nhl:'hockey/nhl',baseball_mlb:'baseball/mlb'};
const cache=new Map();
const norm=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const startMs=value=>typeof value==='number'?value*1000:Date.parse(value);
function matchGame(play,events){
 const start=startMs(play.start);if(!Number.isFinite(start))return null;
 const matches=(Array.isArray(events)?events:[]).filter(event=>event&&Array.isArray(event.competitions)).flatMap(event=>event.competitions.filter(game=>Array.isArray(game.competitors)).map(game=>({event,game}))).filter(({event,game})=>{
  const home=game.competitors?.find(x=>x.homeAway==='home'),away=game.competitors?.find(x=>x.homeAway==='away');
  return home&&away&&norm(home.team?.displayName)===norm(play.home)&&norm(away.team?.displayName)===norm(play.away)&&Math.abs(Date.parse(game.date||event.date)-start)<=90*60000;
 });return matches.length===1?matches[0]:null;
}
function moneylineProbability(play,summary,now=Date.now()){
 if(play.market!=='h2h')return null;
 const plays=Array.isArray(summary?.plays)?summary.plays:summary?.plays==null&&summary?.drives?[...(Array.isArray(summary.drives.previous)?summary.drives.previous:[]).flatMap(d=>Array.isArray(d.plays)?d.plays:[]),...(Array.isArray(summary.drives.current?.plays)?summary.drives.current.plays:[])]:null;
 const game=summary?.header?.competitions?.[0];if(!Array.isArray(game?.competitors)||!Array.isArray(summary?.winprobability)||!Array.isArray(plays))return null;if(game?.status?.type?.state!=='in'||Math.abs(Date.parse(game.date)-startMs(play.start))>90*60000||!Number.isFinite(Date.parse(game.date)))return null;
 const home=game.competitors?.find(x=>x.homeAway==='home'),away=game.competitors?.find(x=>x.homeAway==='away');
 if(norm(home?.team?.displayName)!==norm(play.home)||norm(away?.team?.displayName)!==norm(play.away))return null;
 const side=norm(play.side)===norm(play.home)?'home':norm(play.side)===norm(play.away)?'away':null;if(!side)return null;
 const point=summary.winprobability?.at(-1),eventPlay=plays.find(x=>String(x.id)===String(point?.playId));
 const at=Date.parse(eventPlay?.wallclock),homeWin=point?.homeWinPercentage,tie=point?.tiePercentage??0;
 if(!Number.isFinite(at)||now-at>180000||at>now+5000||typeof homeWin!=='number'||!Number.isFinite(homeWin)||homeWin<0||homeWin>1||typeof tie!=='number'||!Number.isFinite(tie)||tie<0||tie>1||homeWin+tie>1)return null;
 const win=side==='home'?homeWin:1-homeWin-tie;return {win,lose:1-win-tie,tie,as_of:new Date(at).toISOString(),source:'ESPN game-win model'};
}
function scoreView(play,matched,checkedAt){
 const {event,game}=matched,home=game.competitors.find(x=>x.homeAway==='home'),away=game.competitors.find(x=>x.homeAway==='away');
 const state=game.status?.type?.state||event.status?.type?.state;
 const valid=x=>(typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0;
 if(!['pre','in','post'].includes(state)||!/^\d+$/.test(String(event.id)))return null;
 return {event_id:String(event.id),state,status:game.status?.type?.shortDetail||event.status?.type?.shortDetail||state,home:play.home,away:play.away,home_score:state!=='pre'&&valid(home.score)?Number(home.score):null,away_score:state!=='pre'&&valid(away.score)?Number(away.score):null,checked_at:new Date(checkedAt).toISOString(),source:'ESPN',url:`https://www.espn.com/${paths[play.sport].split('/')[1]}/game/_/gameId/${event.id}`,probability:null};
}
async function cachedJson(key,url,fetcher,now){
 const current=cache.get(key);if(current&&now-current.at<60000)return current.promise;
 if(cache.size>80)for(const [key,value]of cache)if(now-value.at>60000)cache.delete(key);
 const promise=(async()=>{const response=await fetcher(url,{signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});if(!response.ok)throw Error('score_source_unavailable');return {...await response.json(),_checked_at:now};})();
 cache.set(key,{at:now,promise});try{return await promise;}catch(error){cache.delete(key);throw error;}
}
async function enrichLiveScores(rows,{fetcher=fetch,now=Date.now()}={}){
 const selected=rows.filter(row=>{const at=startMs(row.play.start);return typeof paths[row.play.sport]==='string'&&Number.isFinite(at)&&now-at<36*3600000&&at-now<24*3600000;});
 const boards=new Map(),jobs=[];
 for(const row of selected){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(startMs(row.play.start)).replaceAll('-','');const key=row.play.sport+':'+day;
  if(!boards.has(key)&&boards.size<12){const promise=cachedJson(key,`https://site.api.espn.com/apis/site/v2/sports/${paths[row.play.sport]}/scoreboard?dates=${day}&limit=1000${row.play.sport==='basketball_ncaab'?'&groups=50':''}`,fetcher,now).catch(()=>null);boards.set(key,promise);}jobs.push({row,key});
 }
 await Promise.all(boards.values());let summaries=0,models=0;const details=new Map(),estimates=new Map();
 return Promise.all(rows.map(async row=>{
  const job=jobs.find(x=>x.row===row);if(!job)return {...row,live:null};
  const board=await boards.get(job.key);if(!board)return {...row,live:{unavailable:true}};
  const matched=matchGame(row.play,board.events);if(!matched)return {...row,live:{unavailable:true}};
  const live=scoreView(row.play,matched,board._checked_at);if(!live)return {...row,live:{unavailable:true}};
  let summary=null;
  const footballOvertime=row.play.sport.startsWith('americanfootball_')&&matched.game.status?.period>4;
  if(live.state==='in'&&(row.play.market==='h2h'||footballOvertime)){
   const key=row.play.sport+':summary:'+live.event_id;
   if(!details.has(key)&&summaries<8){summaries++;details.set(key,cachedJson(key,`https://site.api.espn.com/apis/site/v2/sports/${paths[row.play.sport]}/summary?event=${live.event_id}`,fetcher,now).catch(()=>null));}
   summary=await details.get(key);if(summary&&String(summary.header?.competitions?.[0]?.id)===live.event_id)live.probability=moneylineProbability(row.play,summary,now);
  }
  if(live.state==='in'&&!live.probability){
   const key=JSON.stringify([row.play.sport,live.event_id,row.play.market,row.play.side,row.play.point??row.play.line]);
   if(!estimates.has(key)&&models<80){models++;const game={...matched.game,seasonType:matched.event.season?.type};if(footballOvertime&&String(summary?.header?.competitions?.[0]?.id)===live.event_id&&Array.isArray(summary?.drives?.previous))game.otCompleted=summary.drives.previous.filter(d=>d.start?.period?.number>=5&&(row.play.sport==='americanfootball_nfl'||d.start.period.number===game.status.period)).map(d=>d.team?.id);estimates.set(key,modelProbability(row.play,game,board._checked_at,now));}
   live.probability=estimates.get(key)||null;
  }
  return {...row,live};
 }));
}
module.exports={paths,matchGame,moneylineProbability,scoreView,enrichLiveScores};
