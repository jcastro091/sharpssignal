// Calculate money in integer cents. Never infer a missing result from odds.
function aggregate(slips) {
  const settled = slips.filter(s => s.status === 'completed');
  const known = settled.filter(s => Number.isSafeInteger(s.netProfitCents));
  const roiRows = known.filter(s => Number.isSafeInteger(s.adjustedStakeCents ?? s.stakeCents) && (s.adjustedStakeCents ?? s.stakeCents) > 0);
  const risk = s => s.adjustedStakeCents ?? s.stakeCents;
  const stake = roiRows.reduce((n,s) => n + risk(s), 0);
  const open = slips.filter(s => s.status === 'pending');
  return { count: slips.length, settled: settled.length, known: known.length,
    missingProfit: settled.length - known.length,
    netProfitCents: known.length ? known.reduce((n,s) => n + s.netProfitCents, 0) : null,
    settledStakeCents: stake, roi: stake ? roiRows.reduce((n,s) => n + s.netProfitCents, 0) / stake : null,
    roiCount: roiRows.length, openCount: open.length,
    openStakeCents: open.reduce((n,s) => n + (Number.isSafeInteger(risk(s)) ? risk(s) : 0), 0),
    missingOpenStake: open.filter(s => !Number.isSafeInteger(risk(s))).length,
    wins: settled.filter(s => s.outcome === 'win').length,
    losses: settled.filter(s => s.outcome === 'loss').length };
}
function groups(slips, field) {
  const buckets = new Map();
  for (const s of slips) { const key = s[field] || 'Unknown'; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(s); }
  return [...buckets].map(([name,rows]) => ({name,...aggregate(rows)}));
}
function filterSlips(slips, {book = '', market = '', from = '', to = ''} = {}) {
  const start = from ? Date.parse(from + 'T00:00:00Z') : null;
  const end = to ? Date.parse(to + 'T23:59:59.999Z') : null;
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) ||
    (from && !Number.isFinite(start)) || (to && !Number.isFinite(end)) || (from && to && start > end)) throw Error('Choose a valid date range.');
  return slips.filter(s => (!book || s.book === book) && (!market || s.market === market) &&
    (!from || Date.parse(s.placedAt) >= start) && (!to || Date.parse(s.placedAt) <= end));
}
function insights(slips) {
  return { total: aggregate(slips), books: groups(slips, 'book'), markets: groups(slips, 'market'), leagues: groups(slips, 'league') };
}
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
function answer(plan, slips) {
  if (!['book','market','league','overview'].includes(plan.dimension) || !['best','worst'].includes(plan.direction) || !['profit','roi'].includes(plan.metric)) {
    return { text: 'Ask about profit, ROI, sportsbooks, markets or leagues within the selected filters. For a different period, change the date filters first.', rows: [] };
  }
  if (plan.dimension === 'overview') {
    const s = aggregate(slips);
    return { text: s.known ? `${money(s.netProfitCents)} net result from ${s.known} settled slips with reported profit. ${s.openCount} slips remain open.` : 'There are no settled slips with reported profit in this view.', rows: [] };
  }
  const rows = groups(slips, plan.dimension).filter(s => plan.metric === 'roi' ? s.roi !== null : s.netProfitCents !== null)
    .sort((a,b) => ((plan.metric === 'roi' ? a.roi-b.roi : a.netProfitCents-b.netProfitCents) * (plan.direction === 'best' ? -1 : 1)) || a.name.localeCompare(b.name));
  if (!rows.length) return {text:'There are no settled slips with enough reported accounting to compare in this view.',rows:[]};
  const first = rows[0], metric = plan.metric === 'roi' ? (first.roi*100).toFixed(1)+'% ROI' : money(first.netProfitCents)+' net result';
  return { text: `${first.name} has the ${plan.direction === 'best' ? 'highest' : 'lowest'} ${plan.metric === 'roi' ? 'ROI' : 'net result'} in this view: ${metric}, across ${plan.metric === 'roi' ? first.roiCount : first.known} measured settled slips. ${plan.direction === 'worst' && first.netProfitCents >= 0 ? 'None of the compared groups has a reported net loss. ' : ''}This describes the imported sample; it does not establish a future betting edge.`, rows: rows.slice(0,10) };
}
module.exports = {aggregate, groups, filterSlips, insights, answer};
