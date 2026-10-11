const { displayLabel } = require('./uiLabels.cjs');

// Only realized, closed trades can be graded from net paper P&L.
function marketOutcome(trade) {
  if (trade?.status !== 'closed') return displayLabel(trade?.status);
  if (!Number.isFinite(trade.net_pnl)) return 'Ungraded';
  return trade.net_pnl > 0 ? 'Win' : trade.net_pnl < 0 ? 'Loss' : 'Breakeven';
}
module.exports = { marketOutcome };
