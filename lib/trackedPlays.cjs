const crypto = require('node:crypto');
const {signalKey} = require('./signalChanges.cjs');
const clean = value => String(value ?? '').trim();
const cents = value => Math.round(Number(value) * 100);
function publicationKey(play) { return JSON.stringify([play.cohort, play.play_key, play.line ?? play.point ?? null]); }
function resultOf(value) {
  return ({win:'win',won:'win',loss:'loss',lost:'loss',push:'push',void:'void',refund:'void'})[clean(value).toLowerCase()] || null;
}
function canTail(play, now=Date.now()) {
  const start = typeof play?.start === 'number' ? play.start * 1000 : Date.parse(play?.start);
  return Boolean(play?.entry_id && play?.play_key && play?.side && Number.isFinite(start) && start > now && !resultOf(play.result));
}
function createTrackedPlay(user, play, input, now=Date.now()) {
  if (!canTail(play, now)) throw Error('This pick has started or is already settled.');
  const book=clean(input.sportsbook), odds=Number(input.odds), stake=Number(input.stake);
  if (!book || book.length>60) throw Error('Enter a sportsbook (60 characters maximum).');
  if (!Number.isInteger(odds) || Math.abs(odds)<100 || Math.abs(odds)>100000) throw Error('Enter valid American odds, such as -110 or +150.');
  if (!Number.isFinite(stake) || stake<=0 || stake>100000 || Math.abs(stake*100-Math.round(stake*100))>0.00001) throw Error('Enter a stake between $0.01 and $100,000 with at most two decimal places.');
  const key=publicationKey(play);
  return {id:crypto.createHash('sha256').update(JSON.stringify([user.id,key])).digest('hex'), user_id:user.id, play_key:key, snapshot:play,
    sportsbook:book, odds_american:odds, stake_cents:cents(stake), created_at:new Date(now).toISOString()};
}
function gradeTrackedPlay(row, latest) {
  const sourceMatches=row.snapshot.entry_id && latest && (latest.entry_id===row.snapshot.entry_id || (Array.isArray(latest.source_entry_ids) && latest.source_entry_ids.includes(row.snapshot.entry_id)));
  const result=sourceMatches && !latest.quarantined && latest.settlement_status==='verified_final_score' && publicationKey(latest)===row.play_key && latest.side===row.snapshot.side ? resultOf(latest.result) : null;
  const pnl=result==='loss'?-row.stake_cents:result==='win'?Math.round(row.stake_cents*(row.odds_american>0?row.odds_american/100:100/Math.abs(row.odds_american))):result?0:null;
  return {id:row.id,created_at:row.created_at,notes:row.notes||'',tags:row.tags||[],play:row.snapshot,sportsbook:row.sportsbook,odds:row.odds_american,stake_cents:row.stake_cents,result:result||'pending',pnl_cents:pnl};
}
function summarize(rows) {
  const settled=rows.filter(x=>x.pnl_cents!==null), risked=settled.filter(x=>x.result!=='void');
  const stake=risked.reduce((n,x)=>n+x.stake_cents,0), pnl=settled.reduce((n,x)=>n+x.pnl_cents,0);
  const wins=settled.filter(x=>x.result==='win').length,losses=settled.filter(x=>x.result==='loss').length;
  return {total:rows.length,pending:rows.length-settled.length,wins,losses,pushes:settled.filter(x=>x.result==='push').length,voids:settled.filter(x=>x.result==='void').length,pnl_cents:pnl,settled_stake_cents:stake,open_stake_cents:rows.filter(x=>x.pnl_cents===null).reduce((n,x)=>n+x.stake_cents,0),roi:stake?pnl/stake:null,win_rate:wins+losses?wins/(wins+losses):null};
}
function tagNames(rows) {return [...new Map(rows.flatMap(row=>row.tags||[]).map(tag=>[tag.toLowerCase(),tag])).values()];}
function dashboard(rows, filters={}) {
  const selected=rows.filter(x=>(!filters.book || x.sportsbook===filters.book)&&(!filters.market || x.play.market===filters.market)&&(!filters.status || (filters.status==='pending'?x.result==='pending':x.result!=='pending'))&&(!filters.tag || (x.tags||[]).some(tag=>tag.toLowerCase()===String(filters.tag).toLowerCase()))&&(!filters.notes || (x.notes||'').toLowerCase().includes(String(filters.notes).trim().toLowerCase())));
  const group=field=>[...new Set(selected.map(field))].map(name=>({name,...summarize(selected.filter(x=>field(x)===name))})).sort((a,b)=>b.pnl_cents-a.pnl_cents);
  return {rows:selected,summary:summarize(selected),books:group(x=>x.sportsbook),markets:group(x=>x.play.market),tags:tagNames(selected).map(name=>({name,...summarize(selected.filter(x=>(x.tags||[]).some(tag=>tag.toLowerCase()===name.toLowerCase())))}))};
}
function answerQuestion(data, question) {
  const q=clean(question).toLowerCase();
  if (!q || q.length>500) throw Error('Ask a question of up to 500 characters.');
  if (/last|yesterday|today|week|month|year|since|before|after|other user|everyone/.test(q)) return 'Use the dashboard filters for the scope you want. I can compare your displayed sportsbooks and markets by profit or ROI.';
  const rows=/sportsbook|\bbook\b|\bbooks\b/.test(q)?data.books:/market|crushing/.test(q)?data.markets:null;
  if (!rows) return 'Ask which sportsbook or market has the highest or lowest profit, or the best ROI. Answers use only your tracked plays and current filters.';
  const roi=/roi|return/.test(q), worst=/losing|lost|worst|lowest|loss/.test(q);
  const ranked=rows.filter(x=>x.wins+x.losses+x.pushes>0&&(!roi||x.roi!==null)).sort((a,b)=>(worst?1:-1)*((roi?a.roi:a.pnl_cents)-(roi?b.roi:b.pnl_cents)));
  if (!ranked.length) return 'There are no graded plays in this view yet. Your results will appear when matching results are released.';
  const top=ranked[0], money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(top.pnl_cents/100);
  return `${top.name} has the ${worst?'lowest':'highest'} ${roi?'ROI':'net profit'} in this view: ${money} net profit and ${top.roi===null?'unavailable':(top.roi*100).toFixed(1)+'%'} ROI across ${top.wins+top.losses+top.pushes} graded plays (${top.wins} wins, ${top.losses} losses, ${top.pushes} pushes). These are user-recorded plays, not sportsbook-verified results. Small samples do not establish a future edge.`;
}
module.exports={publicationKey,resultOf,canTail,createTrackedPlay,gradeTrackedPlay,summarize,dashboard,answerQuestion,signalKey};

const {suggestedTags}=require('./betTags.cjs');
function annotation(input) {
  if(typeof input.notes!=='string'||input.notes.length>2000||input.notes.includes('\u0000'))throw Error('Notes must be text of up to 2,000 characters.');
  if(!Array.isArray(input.tags)||input.tags.length>10||input.tags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.trim().length>40||/[\x00-\x1f\x7f]/.test(tag)))throw Error('Choose up to 10 tags, each up to 40 characters.');
  const tags=[];for(const value of input.tags){const tag=value.trim();if(!tags.some(x=>x.toLowerCase()===tag.toLowerCase()))tags.push(tag);}
  return {notes:input.notes.trim(),tags};
}
function insight(rows, filters, intent) {
  if(!['book','market','tag','overview'].includes(intent.dimension))return 'I can summarize this view or compare sportsbooks, markets and tags by profit or ROI. Select a tag or search your notes to focus your question.';
  if(intent.tag && !rows.some(row=>(row.tags||[]).includes(intent.tag)))return 'That tag is not in your saved plays. Choose a saved tag or search your notes above.';
  const base=dashboard(rows,filters).rows;
  const scoped=dashboard(base,{tag:intent.tag||'',notes:typeof intent.notes==='string'?intent.notes:''});
  const scope=[filters.tag||null,filters.notes?`notes containing “${filters.notes}”`:null,intent.tag||null,intent.notes?`notes containing “${intent.notes}”`:null].filter(Boolean);
  const prefix=scope.length?`For ${[...new Set(scope)].join(' + ')}: `:'';
  if(!scoped.rows.length)return prefix+'No tracked plays match. Try another tag or notes search.';
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
  const describe=s=>`${s.total} tracked plays: ${s.wins} wins, ${s.losses} losses, ${s.pushes} pushes, ${s.voids} voids and ${s.pending} pending. Net profit ${money(s.pnl_cents)}; settled ROI ${s.roi===null?'unavailable':(s.roi*100).toFixed(1)+'%'}.`;
  if(intent.dimension==='overview')return prefix+describe(scoped.summary)+' Results use your saved odds and stakes; pending bets are excluded from profit and ROI.';
  const metric=intent.metric==='roi'?'roi':'pnl_cents',worst=intent.direction==='worst';
  const groups=intent.dimension==='book'?scoped.books:intent.dimension==='market'?scoped.markets:scoped.tags;
  const ranked=groups.filter(x=>x.wins+x.losses+x.pushes>0&&x[metric]!==null).sort((a,b)=>(worst?1:-1)*(a[metric]-b[metric]));
  if(!ranked.length)return prefix+'There are no graded plays in this view yet.';
  return prefix+`${ranked[0].name} has the ${worst?'lowest':'highest'} ${metric==='roi'?'ROI':'net profit'}. `+describe(ranked[0])+(intent.dimension==='tag'?' A play can have multiple tags, so tag groups can overlap.':'')+' User-recorded results; small samples do not establish a future edge.';
}
module.exports.annotation=annotation;module.exports.suggestedTags=suggestedTags;module.exports.insight=insight;

function quickIntent(question) {
  return ({'summarize this view':{dimension:'overview'},'which tag has the best roi?':{dimension:'tag',metric:'roi',direction:'best'},'what sportsbooks am i losing with the most?':{dimension:'book',metric:'profit',direction:'worst'},'what markets are we crushing?':{dimension:'market',metric:'profit',direction:'best'}})[clean(question).toLowerCase()]||null;
}
module.exports.quickIntent=quickIntent;

module.exports.tagNames=tagNames;
