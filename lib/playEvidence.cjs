const {sportsbookName}=require('./sportsbookDisplay.cjs');

function strategiesFor(play) {
  const matches=Array.isArray(play?.matched_strategies)?play.matched_strategies:[];
  if(matches.length)return matches.filter(x=>typeof x==='string'&&x.trim());
  return play?.arm?[play.arm]:play?.cohort==='Independent ML'?['Independent ML']:[];
}

function personalClv(row, source, result) {
  const quote=source?.closing_decimal;
  const savedAt=Date.parse(row.created_at)/1000;
  if(result==='void'||source?.quarantined||source?.clv_status!=='measured'||
    !Number.isFinite(quote)||quote<=1||!Number.isFinite(source.closing_at)||
    !Number.isFinite(savedAt)||savedAt>=source.closing_at||
    !row.sportsbook||!source.book||sportsbookName(row.sportsbook)!==sportsbookName(source.book))return null;
  const odds=row.odds_american;
  if(!Number.isFinite(odds)||Math.abs(odds)<100)return null;
  const taken=1+(odds>0?odds/100:100/-odds);
  return taken/quote-1;
}

module.exports={strategiesFor,personalClv};
