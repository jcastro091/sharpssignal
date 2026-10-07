const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, configuration, internalId, normalizeSlip, summary } = require('../lib/sportsbookResults.cjs');
const env = { SHARPSPORTS_SANDBOX_ENABLED: 'true', SHARPSPORTS_SANDBOX_KEY: 'sandbox_fixture_only', SHARPSPORTS_IDENTITY_SECRET: 'test-only-identity-key-32-characters' };
const user = { id: 'user-A', email_confirmed_at: 'yes' };
const id = internalId(user.id, env.SHARPSPORTS_IDENTITY_SECRET);
const request = { method: 'GET', headers: { origin: 'https://app.test', host: 'app.test' }, query: {} };
const response = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(body) { this.body=body; this.code ||= 200; return this; } });
function fixture(data) { return { ok: true, status: 200, json: async () => data }; }
async function run(req = request, overrides = {}) {
  const res = response();
  await createHandler({ env, getUser: async () => user, fetchImpl: async () => { throw Error('Unexpected network'); }, ...overrides })(req, res);
  return res;
}
test('disabled and live credentials never call the provider', async () => {
  for (const change of [{SHARPSPORTS_SANDBOX_ENABLED:'false'}, {SHARPSPORTS_SANDBOX_KEY:'private_live_test'}, {SHARPSPORTS_IDENTITY_SECRET:''}]) {
    assert.equal(configuration({...env,...change}).ready,false);
    assert.equal((await run(request, {env:{...env,...change}})).body.configured,false);
  }
});
test('configuration stays available before the first bettor exists', async () => {
  const res=await run({...request,query:{view:'configuration'}});
  assert.equal(res.code,200); assert.equal(res.body.configured,true);
  assert.equal(res.body.accounts,undefined);
  assert.doesNotMatch(JSON.stringify(res.body),/fixture_only|identity-key/);
});
test('anonymous, unverified, cross-origin and unsupported methods fail closed', async () => {
  assert.equal((await run(request,{getUser:async()=>null})).code,401);
  assert.equal((await run(request,{getUser:async()=>({id:'x'})})).code,401);
  assert.equal((await run({...request,method:'POST',headers:{...request.headers,origin:'https://evil.test'}})).code,403);
  assert.equal((await run({...request,method:'DELETE'})).code,405);
});
test('linking requires consent and rejects unknown actions', async () => {
  assert.equal((await run({...request,method:'POST',body:{action:'link'}})).code,400);
  assert.equal((await run({...request,method:'POST',body:{action:'publish'}})).code,400);
});
test('verified identity owns link context; supplied user identifiers cannot override it', async () => {
  const calls=[];
  const res=await run({...request,method:'POST',body:{action:'link',consent:true,internalId:'victim'}},{fetchImpl:async(url,opts)=>{
    calls.push({url,opts}); return fixture(url.endsWith('/auth')?{token:'test_extension_token'}:{cid:'CTX_test'});
  }});
  assert.equal(res.code,200); assert.equal(res.body.linkUrl,'https://ui.sharpsports.io/link/CTX_test');
  for(const call of calls) assert.equal(JSON.parse(call.opts.body).internalId,id);
  assert.notEqual(internalId('user-B',env.SHARPSPORTS_IDENTITY_SECRET),id);
  assert.doesNotMatch(JSON.stringify(res.body),/identity-key/);
});
test('unexpected extension/context responses fail instead of creating a bogus connection', async () => {
  for(const payload of [{}, {token:'token',cid:'https://evil.test'}]) {
    const res=await run({...request,method:'POST',body:{action:'link',consent:true}},{fetchImpl:async()=>fixture(payload)});
    assert.equal(res.code,502); assert.equal(res.body.linkUrl,undefined);
  }
});
test('results are identity-scoped, deduplicated and exclude foreign or disconnected accounts', async () => {
  const slip={id:'SLIP_one',bettor:'BTTR_me',bettorAccount:'BACT_me',status:'completed',outcome:'loss',atRisk:2500,netProfit:-2500,book:{name:'FanDuel'},bets:[]};
  const calls=[];
  const res=await run({...request,query:{internalId:'victim'}},{fetchImpl:async(url)=>{
    calls.push(url);
    if(url.endsWith('/bettorAccounts')) return fixture([{id:'BACT_me',verified:true},{id:'BACT_removed',access:false}]);
    if(url.includes('/betSlips?')) return fixture([slip,slip,{...slip,id:'SLIP_other',bettor:'BTTR_other'},{...slip,id:'SLIP_removed',bettorAccount:'BACT_removed'}]);
    return fixture({id:'BTTR_me',internalId:id});
  }});
  assert.equal(res.code,200); assert.equal(res.body.slips.length,1); assert.equal(res.body.accounts.length,1);
  assert.equal(res.body.summary.netProfitCents,-2500);
  for(const url of calls) assert.ok(url.includes('/bettors/'+id));
  assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('wrong provider owner rejected; upstream errors never expose secrets', async () => {
  assert.equal((await run(request,{fetchImpl:async()=>fixture({id:'BTTR_other',internalId:'victim'})})).code,502);
  const res=await run(request,{fetchImpl:async()=>({ok:false,status:401,json:async()=>({secret:'credential'})})});
  assert.equal(res.code,502); assert.doesNotMatch(JSON.stringify(res.body),/credential/);
});
test('only a missing bettor is an empty state, not an upstream failure', async () => {
  const res=await run(request,{fetchImpl:async()=>({ok:false,status:404})});
  assert.equal(res.code,200); assert.deepEqual(res.body.slips,[]); assert.equal(res.body.summary.netProfitCents,null);
});
test('cashouts, partial outcomes and unknown accounting preserve provider cents', () => {
  const slips=[
    normalizeSlip({status:'completed',outcome:'cashout',atRisk:2000,netProfit:-350}),
    normalizeSlip({status:'completed',outcome:'halfwin',netProfit:525}),
    normalizeSlip({status:'completed',netProfit:null}),
    normalizeSlip({status:'pending',netProfit:500}),
  ];
  assert.deepEqual(summary(slips),{count:4,settled:3,missingProfit:1,netProfitCents:175});
  assert.equal(normalizeSlip({status:'completed',netProfit:'100'}).netProfitCents,null);
});
test('disconnect verifies ownership before revoking provider access', async () => {
  const calls=[];
  const fetchImpl=async(url,opts)=>{calls.push({url,opts});return fixture(url.endsWith('/bettorAccounts')?[{id:'BACT_me'}]:{});};
  const bad=await run({...request,method:'POST',body:{action:'disconnect',accountId:'BACT_other'}},{fetchImpl});
  assert.equal(bad.code,404); assert.equal(calls.length,1);
  const good=await run({...request,method:'POST',body:{action:'disconnect',accountId:'BACT_me'}},{fetchImpl});
  assert.equal(good.code,200); assert.equal(calls.at(-1).opts.method,'PUT');
  assert.deepEqual(JSON.parse(calls.at(-1).opts.body),{access:false});
});
