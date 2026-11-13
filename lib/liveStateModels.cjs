// Reproducible Monte Carlo outcome distributions for sports without a continuous scoring clock.
// Probabilities below are explicit engineering assumptions, not calibrated league statistics.
const SAMPLES=6000,cache=new Map();
function randomFor(value){let seed=2166136261;for(const c of value)seed=Math.imul(seed^c.charCodeAt(0),16777619);return ()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function outcomes(key,run){if(cache.has(key))return cache.get(key);const random=randomFor(key),counts=new Map();for(let i=0;i<SAMPLES;i++){const score=run(random);if(!score||!score.every(Number.isFinite))return null;const k=score.join(',');counts.set(k,(counts.get(k)||0)+1);}const result=[...counts].map(([k,n])=>[...k.split(',').map(Number),n/SAMPLES]);if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,result);return result;}
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
function baseballState(game){
 const status=game.status,s=game.situation||{},inning=status?.period,detail=[status?.type?.name,status?.type?.detail,status?.type?.shortDetail].join(' ');
 if(!integer(inning,1,40)||![2,3].includes(game.seasonType))return null;
 let half=/\btop\b|STATUS_TOP/i.test(detail)?0:/\bbot(?:tom)?\b|STATUS_BOTTOM/i.test(detail)?1:null,outs=s.outs,bases;
 if(/\bmid(?:dle)?\b|STATUS_MIDDLE/i.test(detail)){half=1;outs=0;bases=[false,false,false];}
 else if(/\bend\b|STATUS_END/i.test(detail))return {inning:inning+1,half:0,outs:0,bases:[false,game.seasonType===2&&inning>=9,false]};
 else {if(!integer(outs,0,3)||!['onFirst','onSecond','onThird'].every(k=>typeof s[k]==='boolean'))return null;bases=[s.onFirst,s.onSecond,s.onThird];}
 if(half===null)return null;
 if(outs===3){half=1-half;const next=inning+(half===0?1:0);return {inning:next,half,outs:0,bases:[false,game.seasonType===2&&next>9,false]};}
 return {inning,half,outs,bases};
}
function baseballOutcomes(game,h,a){
 const initial=baseballState(game);if(!initial)return null;
 if(game.status.period>=9&&h!==a&&(/\bend\b|STATUS_END/i.test([game.status.type.detail,game.status.type.shortDetail,game.status.type.name].join(' '))||game.situation?.outs===3&&/\bbot(?:tom)?\b/i.test(game.status.type.detail||'')))return [[h,a,1]];
 const regular=game.seasonType===2,key=JSON.stringify(['baseball-state-v1',h,a,initial,regular]);
 return outcomes(key,r=>{
  let home=h,away=a,inning=initial.inning,half=initial.half,outs=initial.outs,bases=[...initial.bases];
  for(let appearances=0;appearances<2000&&inning<=50;appearances++){
   if(half===1&&inning>=9&&home>away)return [home,away];
   let runs=0,hr=false;const event=r();
   if(event<.68){
    if(bases[0]&&outs<2&&r()<.12){outs+=2;bases[0]=false;}
    else {if(bases[2]&&outs<2&&r()<.12){runs++;bases[2]=false;}outs++;}
   }else if(event<.765){if(bases[0]){if(bases[1]){if(bases[2])runs++;bases[2]=true;}bases[1]=true;}bases[0]=true;}
   else if(event<.915){
    if(bases[2])runs++;let third=false,second=false;
    if(bases[1]){if(r()<.6)runs++;else third=true;}
    if(bases[0]){if(!third&&r()<.25)third=true;else second=true;}
    bases=[true,second,third];
   }else if(event<.96){runs+=Number(bases[2])+Number(bases[1]);let third=false;if(bases[0]){if(r()<.5)runs++;else third=true;}bases=[false,true,third];}
   else if(event<.965){runs+=bases.filter(Boolean).length;bases=[false,false,true];}
   else {runs+=1+bases.filter(Boolean).length;bases=[false,false,false];hr=true;}
   if(half===0)away+=runs;else {home+=runs;if(inning>=9&&home>away)return [hr?home:away+1,away];}
   if(outs>=3){
    if(half===0){half=1;if(inning>=9&&home>away)return [home,away];}
    else {if(inning>=9&&home!==away)return [home,away];half=0;inning++;}
    outs=0;bases=[false,regular&&inning>9,false];
   }
  }
  return null;
 });
}
function footballClock(status){
 const m=/^(\d{1,2}):(\d{2})(?:\.\d+)?$/.exec(String(status.displayClock||''));const decimal=/^\d{1,2}(?:\.\d+)?$/.test(String(status.displayClock||''))?Number(status.displayClock):null;
 if(!integer(status.period,1,30)||(!m&&decimal===null)||(m&&Number(m[2])>=60)||(decimal!==null&&decimal>=60))return null;
 const seconds=m?Number(m[1])*60+Number(m[2]):decimal;
 if(seconds>900)return null;
 return seconds;
}
function fieldPosition(game){
 const s=game.situation||{},team=game.competitors.find(c=>String(c.id)===String(s.possession));
 const text=/^([A-Z0-9]+)\s+(\d{1,2})$/i.exec(String(s.possessionText||''));
 if(!text||!team?.team?.abbreviation)return null;
 const yard=Number(text[2]);if(yard>50)return null;
 const own=String(text[1]).toUpperCase()===team.team.abbreviation.toUpperCase();
 const other=game.competitors.find(c=>c!==team)?.team?.abbreviation;
 if(!own&&String(text[1]).toUpperCase()!==String(other).toUpperCase())return null;
 return own?100-yard:yard;
}
function footballOutcomes(game,h,a,sport){
 const status=game.status,s=game.situation||{},college=sport==='americanfootball_ncaaf',period=status.period;
 if(!integer(period,1,30)||![2,3].includes(game.seasonType))return null;
 const home=game.competitors.find(c=>c.homeAway==='home'),away=game.competitors.find(c=>c.homeAway==='away');
 if(!home?.id||!away?.id||String(home.id)===String(away.id)||!['string','number'].includes(typeof s.possession))return null;
 const possessing=String(s.possession)===String(home.id)?0:String(s.possession)===String(away.id)?1:null;
 if(possessing===null)return null;
 const clock=period>4&&college?0:footballClock(status);if(clock===null)return null;
 if(period===5&&!college&&clock>(game.seasonType===2?600:900))return null;
 if(period>5&&!college&&game.seasonType===2)return null;
 const remaining=period<=4?(4-period)*900+clock:clock,elapsed=period<=4?Math.max(0,3600-remaining)/60:60+(period-5)*15+((!college&&game.seasonType===2?600:900)-clock)/60;
 const down=integer(s.down,1,4)?s.down:null,distance=typeof s.distance==='number'&&s.distance>=0&&s.distance<=100?s.distance:null,field=fieldPosition(game);
 const prior=college?26:22,rates=[h,a].map(score=>Math.max(.55,Math.min(1.65,(score+prior*.5)/(elapsed+30)/(prior/60))));
 let completed=[];
 if(period>4){if(!Array.isArray(game.otCompleted))return null;completed=game.otCompleted.map(id=>String(id)===String(home.id)?0:String(id)===String(away.id)?1:null);if(completed.includes(null))return null;}
 const key=JSON.stringify(['football-drive-v1',sport,h,a,period,clock,possessing,field,down,distance,s.homeTimeouts,s.awayTimeouts,game.seasonType,completed]);
 return outcomes(key,r=>{
  let score=[h,a],pos=possessing,time=remaining,first=true;
  function drive(team,{yards=null,current=false,round=0,seconds=Infinity}={}){
   if(seconds<3)return 0;
   if(round>=3)return r()<.48?2:0;
   let td=(round ? .43 : college ? .27 : .25)*rates[team],fg=(round ? .22 : .15)*rates[team];
   if(current&&yards!==null){const gain=(75-yards)/100;td+=gain*.35;fg+=gain*.16;
    if(down===4){if(yards<=40){td=.03;fg=Math.max(.15,.88-yards*.008);}else {td=distance!==null&&distance<=2?.11:.025;fg=.015;}}
    else if(down===3&&distance!==null&&distance>10){td*=.65;fg*=.8;}
   }
   td=Math.max(.005,Math.min(.75,td));fg=Math.max(.005,Math.min(.9-td,fg));
   if(seconds<35){const factor=Math.max(.02,seconds/35);td*=factor;fg*=yards!==null&&yards<40?Math.max(.1,seconds/8):factor;}
   const n=r();if(n<td){if(round===2)return r()<.48?8:6;const trailing=score[1-team]-score[team];if(trailing===2||trailing===8)return r()<.48?8:6;return r()<.94?7:6;}return n<td+fg?3:0;
  }
  if(period<=4){
   for(let d=0;time>0&&d<80;d++){
    if(first&&score[pos]>score[1-pos]&&down!==null&&down<4){const defenseTimeouts=pos===0?s.awayTimeouts:s.homeTimeouts;if(defenseTimeouts===0&&time<=40*(4-down)){time=0;break;}}
    const used=Math.max(8,20+(r()+r())*120);score[pos]+=drive(pos,{current:first,yards:first?field:null,seconds:time});time-=used;pos=1-pos;first=false;
   }
   if(score[0]!==score[1])return score;
   pos=r()<.5?0:1;
  }
  if(college){
   let round=period>4?period-4:1;
   for(let n=0;n<50;n++,round++){
    if(n===0&&period>4&&completed.length%2===1){score[pos]+=drive(pos,{round,current:true,yards:field});}
    else {const firstTeam=n===0&&period>4?pos:(r()<.5?0:1);score[firstTeam]+=drive(firstTeam,{round});score[1-firstTeam]+=drive(1-firstTeam,{round});}
    if(score[0]!==score[1])return score;
   }
   return null;
  }
  let possessed=period>4?[completed.includes(0),completed.includes(1)]:[false,false];time=period>4?remaining:game.seasonType===2?600:900;
  for(let d=0;d<80;d++){
   if(time<=0){if(game.seasonType===2)return score;time=900;}
   if(possessed[0]&&possessed[1]&&score[0]!==score[1])return score;
   score[pos]+=drive(pos,{current:period>4&&d===0,yards:period>4&&d===0?field:null,seconds:time});possessed[pos]=true;
   time-=20+(r()+r())*120;
   if(possessed[0]&&possessed[1]&&score[0]!==score[1])return score;
   pos=1-pos;
  }
  return null;
 });
}
module.exports={baseballOutcomes,baseballState,footballOutcomes,footballClock,SAMPLES};
