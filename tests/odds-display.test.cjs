const test=require('node:test');
const assert=require('node:assert/strict');
const {decimalToAmericanLabel,formatAmerican}=require('../lib/oddsDisplay.cjs');
test('captured decimal prices display signed American odds',()=>{
 for(const [value,label] of [[1.95,'-105'],[2.1,'+110'],[1.96,'-104'],[2,'+100'],[2.3,'+130'],[1.5,'-200']])assert.equal(decimalToAmericanLabel(value),label);
 for(const value of [null,undefined,'',1,0,NaN,Infinity,'bad'])assert.equal(decimalToAmericanLabel(value),'—');
 assert.equal(formatAmerican(130),'+130');assert.equal(formatAmerican(-110),'-110');assert.equal(formatAmerican(null),'—');
});
