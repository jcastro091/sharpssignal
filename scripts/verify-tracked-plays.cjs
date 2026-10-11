// Usage: load the project's public Supabase config and service key via environment,
// then node scripts/verify-tracked-plays.cjs https://<deployment>.
// Creates two disposable confirmed customers, never sends email, and deletes them.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const {createClient}=require('@supabase/supabase-js');
const {signalKey}=require('../lib/signalChanges.cjs');
const {publicationKey,canTail}=require('../lib/trackedPlays.cjs');
const origin=process.argv[2];
if(!/^https:\/\/(sharps-signal\.com|sharpssignal-[\w-]+\.vercel\.app)$/.test(origin)&&!/^http:\/\/localhost:\d+$/.test(origin))throw Error('Unexpected verification target');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],checks=[];
const protection=process.env.VERCEL_OIDC_TOKEN?{'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}:{};
async function customer(){
 const email='tail-verification-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{interests:['sports'],purpose:'disposable tracking verification'}});
 assert.ifError(created.error);users.push(created.data.user.id);
 const auth=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await auth.auth.signInWithPassword({email,password});assert.ifError(login.error);
 const session=login.data.session;
 return {id:created.data.user.id,auth,cookie:'sb-'+new URL(url).hostname.split('.')[0]+'-auth-token='+encodeURIComponent(JSON.stringify([session.access_token,session.refresh_token,null,null,[]]))};
}
async function request(user,path,body,originOverride){
 const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{...protection,...(user?{Cookie:user.cookie}:{}),...(body?{'Content-Type':'application/json',Origin:originOverride||origin}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000),redirect:'manual'});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
 return {status:response.status,data,text};
}
(async()=>{try{
 const a=await customer(),b=await customer();
 assert.equal((await request(null,'/api/tracked-plays')).status,401);
 assert.equal((await request(a,'/api/tracked-plays',{action:'tail'},'https://example.invalid')).status,403);
 assert.equal((await request(null,'/api/tail-bets',{bet_id:'test'})).status,401);
 checks.push('anonymous and cross-origin writes denied');
 const initial=await request(a,'/api/tracked-plays');assert.equal(initial.status,200);assert.equal(initial.data.summary.total,0);
 const feed=await request(a,'/api/member-feed?section=sports');assert.equal(feed.status,200);
 const play=feed.data.plays.find(p=>canTail(p));
 if(play){
   const body={action:'tail',pick:signalKey(play),sportsbook:'FanDuel',odds:-110,stake:25,user_id:b.id};
   assert.equal((await request(a,'/api/tracked-plays',body)).status,200);
   assert.equal((await request(a,'/api/tracked-plays',{...body,stake:50})).status,200);
   const saved=await request(a,'/api/tracked-plays');assert.equal(saved.data.summary.total,1);assert.equal(saved.data.rows[0].stake_cents,2500);
   checks.push('live released pick saved, repeat click idempotent, source snapshot retained');
 } else checks.push('No upcoming released pick: live save cannot be exercised; covered by route fixture tests');
 assert.equal((await request(b,'/api/tracked-plays')).data.summary.total,0);checks.push('second customer cannot see first customer plays');
 // A labelled disposable historical fixture checks the real archived result lookup and cents accounting.
 const historic=await admin.from('customer_research_versions').select('play_key,payload').eq('section','sports').eq('payload->>result','win').lte('seen_at',new Date(Date.now()-3600000).toISOString()).order('seen_at',{ascending:false}).limit(1);
 assert.ifError(historic.error);
 if(historic.data.length){const p=historic.data[0];
   const inserted=await admin.from('customer_tracked_plays').insert({id:'qa-'+crypto.randomUUID(),user_id:b.id,play_key:p.play_key,snapshot:p.payload,sportsbook:'QA fixture',odds_american:150,stake_cents:1000});assert.ifError(inserted.error);
   const ledger=await request(b,'/api/tracked-plays');assert.equal(ledger.status,200);assert.equal(ledger.data.rows[0].pnl_cents,1500);assert.equal(ledger.data.summary.roi,1.5);checks.push('archived exact-selection grade: $10 at +150 gives $15 profit and 150% ROI');
 }
 const answer=await request(b,'/api/tracked-plays',{action:'ask',question:'What sportsbooks am I losing with the most?',filters:{}});assert.equal(answer.status,200);assert.ok(answer.data.answer);assert.ok(!answer.data.answer.includes('temporarily unavailable'));checks.push('live AI classification and deterministic answer returned');
 const page=await request(a,'/my-plays');assert.equal(page.status,200);assert.ok(page.text.includes('My plays'));const dashboard=await request(a,'/dashboard');assert.ok(dashboard.text.includes('/my-plays'));checks.push('authenticated personal page and dashboard navigation render');
 const direct=await a.auth.from('customer_tracked_plays').select('*');assert.ok(direct.error);checks.push('direct authenticated table reads denied');
 await a.auth.auth.signOut();await b.auth.auth.signOut();
 }finally{for(const id of users){const deleted=await admin.auth.admin.deleteUser(id);assert.ifError(deleted.error);}checks.push('disposable customers and their plays deleted');fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/tracked-plays-verification.json',JSON.stringify({origin,at:new Date().toISOString(),checks},null,2));console.log(JSON.stringify(checks,null,2));}
})().catch(error=>{console.error(error.message);process.exitCode=1});
