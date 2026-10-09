// Compare released customer-visible records, never feed timestamps or internal strategy fields.
function signalKey(play) {
  return JSON.stringify([play.cohort ?? '', play.entry_id ?? play.trade_id ?? '', play.point ?? play.line ?? null]);
}
const fields = ['side','point','line','home','away','market','decimal','book','start','result','clv_pct','symbol','direction','entry_price','stop','target','status','net_pnl','entry_at','entry_time'];
function signalSnapshot(plays) {
  return new Map(plays.map(play => [signalKey(play), JSON.stringify(fields.map(field => play[field] ?? null))]));
}
function changedSignals(previous, next) {
  if (!previous) return [];
  return [...next].filter(([key, value]) => previous.get(key) !== value).map(([key]) => key);
}
module.exports = {signalKey, signalSnapshot, changedSignals};
