function betAmounts(row) {
 const cost = Number.isSafeInteger(row.stake_cents) && row.stake_cents >= 0 ? row.stake_cents : null;
 if (cost === null) return [];
 const lines = [[row.read_only ? 'Wager incl. fees' : 'Wager', cost]];
 if (row.result === 'pending') {
  let payout = null;
  if (row.read_only && Number.isFinite(row.execution?.contracts) && row.execution.contracts > 0) {
   payout = Math.round(row.execution.contracts * 100);
  } else if (!row.read_only && Number.isInteger(row.odds) && Math.abs(row.odds) >= 100) {
   const profit = row.odds > 0 ? cost * row.odds / 100 : cost * 100 / Math.abs(row.odds);
   payout = cost + Math.round(profit);
  }
  if (payout !== null) lines.push(['Payout if won', payout], ['Net profit if won', payout - cost]);
 } else {
  const actual = row.read_only ? row.execution?.payout_usd : null;
  if (actual != null && actual !== '' && Number.isFinite(Number(actual))) {
   lines.push(['Settlement payout', Math.round(Number(actual) * 100)]);
  } else if (!row.read_only && Number.isSafeInteger(row.pnl_cents)) {
   lines.push(['Settlement payout', cost + row.pnl_cents]);
  }
  if (Number.isSafeInteger(row.pnl_cents)) lines.push(['Net result', row.pnl_cents]);
 }
 return lines;
}

module.exports = {betAmounts};
