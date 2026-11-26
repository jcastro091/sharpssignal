const test=require('node:test'),assert=require('node:assert/strict');
const {gameStart}=require('../lib/gameStart.cjs');
test('venue epoch seconds, milliseconds and ISO retain the exact Eastern start',()=>{
 const expected=gameStart('2026-11-26T16:00:00Z');
 assert.equal(expected.iso,'2026-11-26T16:00:00.000Z');assert.match(expected.label,/11:00 AM EST/);
 for(const value of [1795708800,1795708800000,'1795708800'])assert.deepEqual(gameStart(value),expected);
 assert.match(gameStart('2026-11-26T17:00:00Z').label,/12:00 PM EST/);
});
test('Eastern date rollover and daylight saving are explicit; missing starts are not invented',()=>{
 assert.match(gameStart('2026-07-02T01:00:00Z').label,/Jul 1, 2026.*9:00 PM EDT/);
 for(const bad of [null,undefined,'','bad',NaN,Infinity,0,-1])assert.equal(gameStart(bad),null);
});
