// Experimental scoring-rate model. Assumptions are versioned, not fitted accuracy claims.
// Compound Poisson scoring events; Gamma-style prior smoothing prevents early-game pace explosions.
const settings={
 basketball_nba:{periods:4,minutes:12,total:228,prior:12,marks:[[1,.18],[2,.60],[3,.22]]},
 basketball_ncaab:{periods:2,minutes:20,total:144,prior:12,marks:[[1,.18],[2,.60],[3,.22]]},
 basketball_wnba:{periods:4,minutes:10,total:164,prior:12,marks:[[1,.18],[2,.60],[3,.22]]},
 icehockey_nhl:{periods:3,minutes:20,total:6,prior:30,marks:[[1,1]],hockey:true}
};
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function clockMinutes(status,config){
 const period=status?.period,match=/^(\d{1,2}):(\d{2})(?:\.\d+)?$/.exec(String(status?.displayClock||''));
 if(!Number.isInteger(period)||period<1)return null;
 const seconds=/^\d{1,2}(?:\.\d+)?$/.test(String(status?.displayClock||''))?Number(status.displayClock):null;
 if((!match||Number(match[2])>=60)&&!(seconds!==null&&seconds<60))return null;
 const clock=match?Number(match[1])+Number(match[2])/60:seconds/60;
 if(clock>(period>config.periods?5:config.minutes)||period>config.periods+4)return null;
 return {period,remaining:period>config.periods?clock:(config.periods-period)*config.minutes+clock,elapsed:(Math.min(period,config.periods)-1)*config.minutes+(period>config.periods?config.minutes:config.minutes-clock)+(period>config.periods?(period-config.periods-1)*5+5-clock:0),overtime:period>config.periods};
}
function scoringDistribution(mean,marks){
 if(!Number.isFinite(mean)||mean<0||mean>250)return null;
 const average=marks.reduce((n,[k,p])=>n+k*p,0),lambda=mean/average;
 const variance=lambda*marks.reduce((n,[k,p])=>n+k*k*p,0);
 const size=Math.ceil(mean+12*Math.sqrt(variance)+30),p=Array(size+1).fill(0);p[0]=Math.exp(-lambda);
 for(let n=1;n<=size;n++)for(const [k,weight]of marks)if(n>=k)p[n]+=lambda*k*weight*p[n-k]/n;
 const mass=p.reduce((a,b)=>a+b,0);if(!Number.isFinite(mass)||mass<.999999)return null;
 return p.map(x=>x/mass);
}
function selection(play){
 if(play.market==='totals'){
  const direction=/^(over|under)(?:\s|$)/i.exec(String(play.side||''))?.[1]?.toLowerCase();
  const raw=play.point??play.line;if(raw===null||raw===undefined||raw==='')return null;
  const line=Number(raw);return direction&&Number.isFinite(line)&&line>0&&line<=1000?{direction,line}:null;
 }
 const side=norm(play.side)===norm(play.home)?'home':norm(play.side)===norm(play.away)?'away':null;
 if(!side)return null;if(play.market==='h2h')return {side,line:0};
 const raw=play.point??play.line;if(play.market!=='spreads'||raw===null||raw===undefined||raw==='')return null;
 const line=Number(raw);return Number.isFinite(line)&&Math.abs(line)<=200?{side,line}:null;
}
function modelProbability(play,game,checkedAt,now=Date.now()){
 const config=settings[play.sport],pick=selection(play),status=game?.status;
 if(!config||!pick||status?.type?.state!=='in'||status.type.completed||/delay|suspend|cancel|postpon|shootout/i.test([status.type.name,status.type.description,status.type.shortDetail].join(' ')))return null;
 if(!Number.isFinite(checkedAt)||now-checkedAt>90000||checkedAt>now+5000)return null;
 const start=typeof play.start==='number'?play.start*1000:Date.parse(play.start);
 if(!Number.isFinite(start)||!Number.isFinite(Date.parse(game.date))||Math.abs(Date.parse(game.date)-start)>90*60000)return null;
 if(!Array.isArray(game.competitors))return null;
 const home=game.competitors.find(x=>x.homeAway==='home'),away=game.competitors.find(x=>x.homeAway==='away');
 if(norm(home?.team?.displayName)!==norm(play.home)||norm(away?.team?.displayName)!==norm(play.away))return null;
 const valid=x=>(typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=250;
 if(!valid(home.score)||!valid(away.score))return null;
 const time=clockMinutes(status,config);if(!time||time.elapsed<1)return null;
 const h=Number(home.score),a=Number(away.score);if(config.hockey&&time.overtime&&h!==a)return null;
 const duration=config.periods*config.minutes,priorRate=config.total/duration/2;
 const homeRate=(h+priorRate*config.prior)/(time.elapsed+config.prior),awayRate=(a+priorRate*config.prior)/(time.elapsed+config.prior);
 const hp=scoringDistribution(homeRate*time.remaining,config.marks),ap=scoringDistribution(awayRate*time.remaining,config.marks);if(!hp||!ap)return null;
 const result={win:0,lose:0,push:0};
 function add(hs,as,mass){const margin=pick.direction?(pick.direction==='over'?hs+as-pick.line:pick.line-hs-as):(pick.side==='home'?hs-as:as-hs)+pick.line;result[margin>0?'win':margin<0?'lose':'push']+=mass;}
 // Approximate repeated basketball overtime by one five-minute period conditioned on a non-tie.
 let ot=[];
 if(!config.hockey){const oh=scoringDistribution(homeRate*5,config.marks),oa=scoringDistribution(awayRate*5,config.marks);if(!oh||!oa)return null;let mass=0;for(let i=0;i<oh.length;i++)for(let j=0;j<oa.length;j++)if(i!==j&&oh[i]*oa[j]>1e-12){ot.push([i,j,oh[i]*oa[j]]);mass+=oh[i]*oa[j];}ot=ot.map(([i,j,p])=>[i,j,p/mass]);}
 const ties=[];
 if(config.hockey&&time.overtime)ties.push([h,1]);
 else for(let i=0;i<hp.length;i++)for(let j=0;j<ap.length;j++){
  const mass=hp[i]*ap[j];if(mass<1e-14)continue;
  if(h+i===a+j)ties.push([h+i,mass]);else add(h+i,a+j,mass);
 }
 for(const [score,mass]of ties){if(config.hockey){const share=homeRate/(homeRate+awayRate);add(score+1,score,mass*share);add(score,score+1,mass*(1-share));}else for(const [i,j,p]of ot)add(score+i,score+j,mass*p);}
 const sum=result.win+result.lose+result.push;if(!Number.isFinite(sum)||sum<.99999)return null;
 for(const key of Object.keys(result))result[key]/=sum;
 return {...result,tie:0,as_of:new Date(checkedAt).toISOString(),source:'SharpsSignal experimental model',model:'scoring-rate-v1',experimental:true,market:play.market,assumptions:'Score and clock with smoothed scoring pace; simplified overtime. Not calibrated; ignores possession, injuries, penalties and end-game tactics.'};
}
module.exports={modelProbability,scoringDistribution,clockMinutes};
