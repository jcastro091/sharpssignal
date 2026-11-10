const test=require('node:test'),assert=require('node:assert/strict');
const {startTrackedPlayRefresh}=require('../lib/trackedPlayRefresh.cjs');
test('visible idle pages refresh each minute and on return; hidden/busy/unmounted pages do not',()=>{
 const listeners={},events={};let tick,refreshed=0,idle=true,cleared=false;
 const document={visibilityState:'visible',addEventListener:(k,v)=>events[k]=v,removeEventListener:(k,v)=>{assert.equal(events[k],v);delete events[k]}};
 const window={setInterval:(fn,ms)=>{assert.equal(ms,60000);tick=fn;return 7},clearInterval:id=>{assert.equal(id,7);cleared=true},addEventListener:(k,v)=>listeners[k]=v,removeEventListener:(k,v)=>{assert.equal(listeners[k],v);delete listeners[k]}};
 const original=Date.now;let now=100000;Date.now=()=>now;
 try{
  const stop=startTrackedPlayRefresh({document,window,enabled:()=>idle,refresh:()=>refreshed++});
  tick();assert.equal(refreshed,1);
  now+=60000;document.visibilityState='hidden';tick();assert.equal(refreshed,1);
  document.visibilityState='visible';idle=false;events.visibilitychange();assert.equal(refreshed,1);
  idle=true;listeners.focus();events.visibilitychange();assert.equal(refreshed,2);
  now+=60000;tick();assert.equal(refreshed,3);
  stop();assert.ok(cleared);assert.deepEqual(listeners,{});assert.deepEqual(events,{});
 }finally{Date.now=original;}
});
