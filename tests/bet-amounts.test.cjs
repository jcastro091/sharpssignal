const test = require('node:test');
const assert = require('node:assert/strict');
const {betAmounts} = require('../lib/betAmounts.cjs');

test('collapsed bet card keeps confirmed cash cost separate from payout and net profit', () => {
 const bet = {read_only:true, stake_cents:247, result:'pending', execution:{contracts:5, payout_usd:null}};
 assert.deepEqual(betAmounts(bet), [['Wager incl. fees',247],['Payout if won',500],['Net profit if won',253]]);
 assert.deepEqual(betAmounts({...bet,result:'loss',pnl_cents:-247,execution:{...bet.execution,payout_usd:'0'}}),
  [['Wager incl. fees',247],['Settlement payout',0],['Net result',-247]]);
 assert.deepEqual(betAmounts({stake_cents:1100,odds:-110,result:'pending'}),
  [['Wager',1100],['Payout if won',2100],['Net profit if won',1000]]);
});
