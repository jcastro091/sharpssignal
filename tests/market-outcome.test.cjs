const test = require('node:test');
const assert = require('node:assert/strict');
const { marketOutcome } = require('../lib/marketOutcome.cjs');

test('grades realized trades using net P&L for either direction', () => {
  for (const direction of [1, -1]) {
    assert.equal(marketOutcome({ status: 'closed', direction, net_pnl: -43.37 }), 'Loss');
    assert.equal(marketOutcome({ status: 'closed', direction, net_pnl: 63.42 }), 'Win');
    assert.equal(marketOutcome({ status: 'closed', direction, net_pnl: 0 }), 'Breakeven');
  }
});

test('never invents a result for open trades or missing realized P&L', () => {
  assert.equal(marketOutcome({ status: 'open', net_pnl: 25 }), 'Open');
  for (const net_pnl of [undefined, null, NaN, Infinity, '']) {
    assert.equal(marketOutcome({ status: 'closed', net_pnl }), 'Ungraded');
  }
});
