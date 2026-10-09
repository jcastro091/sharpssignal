const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync('pages/api/admin-launch.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default async function handler', 'async function handler') + '\nmodule.exports=handler;';
function setup({allowed=true, session={access_token:'test-token'}}={}) {
  const calls=[];
  const context={module:{exports:{}},crypto,
    getCeoAccess:async()=>{calls.push('verify');return {allowed};},
    createPagesServerClient:()=>({auth:{
      getSession:async()=>{calls.push('session');return {data:{session}};},
      signOut:async options=>{calls.push(options.scope);}
    }})};
  vm.runInNewContext(source,context);
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},
    end(){return this;},send(body){this.body=body;return this;},redirect(n,url){this.code=n;this.location=url;return this;}};
  return {handler:context.module.exports,res,calls};
}
test('both admin cards establish a backend session before navigation',()=>{
  const page=fs.readFileSync('pages/admin.js','utf8');
  assert.match(page,/href="\/api\/admin-launch"/);
  assert.match(page,/href="\/api\/admin-launch\?target=audience"/);
  assert.doesNotMatch(page,/href="https:\/\/sharpssignal-sports-backend/);
});
test('unauthorized users never get a token handoff',async()=>{
  const {handler,res,calls}=setup({allowed:false});await handler({method:'GET',query:{}},res);
  assert.equal(res.code,303);assert.match(res.location,/^\/signin/);assert.deepEqual(calls,['verify']);assert.equal(res.body,undefined);
});
test('verified admins get a private origin-preserving POST for each allowed destination',async()=>{
  for(const target of ['overview','audience','sports','markets']){
    const {handler,res,calls}=setup();await handler({method:'GET',query:{target}},res);
    assert.equal(res.code,200);assert.deepEqual(calls,['verify','session']);
    assert.match(res.body,/method="post" action="https:\/\/sharpssignal-sports-backend.vercel.app\/api\/admin-session"/);
    assert.ok(res.body.includes('name="target" value="'+target+'"'));
    assert.equal(res.headers['Cache-Control'],'private, no-store');
    assert.equal(res.headers['Referrer-Policy'],'strict-origin-when-cross-origin');
    const nonce=res.body.match(/script nonce="([^"]+)"/)[1];
    assert.ok(res.headers['Content-Security-Policy'].includes("script-src 'nonce-"+nonce+"'"));
  }
});
test('untrusted targets and token characters cannot inject HTML or redirect',async()=>{
  const {handler,res}=setup({session:{access_token:'"<script>&'}});
  await handler({method:'GET',query:{target:'https://evil.test'}},res);
  assert.ok(res.body.includes('name="target" value="overview"'));
  assert.ok(res.body.includes('&quot;&lt;script&gt;&amp;'));assert.ok(!res.body.includes('evil.test'));
});
test('missing session and unsupported method fail closed',async()=>{
  const a=setup({session:null});await a.handler({method:'GET',query:{}},a.res);assert.equal(a.res.code,401);
  const b=setup();await b.handler({method:'POST',query:{}},b.res);assert.equal(b.res.code,405);assert.deepEqual(b.calls,[]);
});
test('logout clears the local website session',async()=>{
  const {handler,res,calls}=setup();await handler({method:'GET',query:{logout:'1'}},res);
  assert.deepEqual(calls,['local']);assert.equal(res.location,'/signin');
});
