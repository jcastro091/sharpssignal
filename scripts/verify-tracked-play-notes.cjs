// Disposable-account production verification; no email or real bets are created.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const origin=process.argv[2];if(origin!=='https://www.sharps-signal.com')throw Error('Unexpected target');
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],clients=[];
async function customer(){const email='notes-verification-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'disposable notes verification'}});assert.ifError(created.error);users.push(created.data.user.id);const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(auth);const login=await auth.auth.signInWithPassword({email,password});assert.ifError(login.error);const s=login.data.session;return {id:created.data.user.id,auth,cookie:'sb-'+new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]+'-auth-token='+encodeURIComponent(JSON.stringify([s.access_token,s.refresh_token,null,null,[]]))};}
async function call(user,body,query=''){const r=await fetch(origin+'/api/tracked-plays'+query,{method:body?'POST':'GET',headers:{Cookie:user.cookie,...(body?{'Content-Type':'application/json',Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});return {status:r.status,data:await r.json()};}
(async()=>{try{
const a=await customer(),b=await customer(),id='notes-test-'+crypto.randomUUID();
const records=[0,1].map(i=>({id:id+i,user_id:a.id,play_key:JSON.stringify(['verification',id+i,null]),snapshot:{entry_id:id+i,cohort:'verification',play_key:id+i,side:'Disposable verification '+i,away:'Fixture away',home:'Fixture home',market:'h2h',start:Date.now()/1000-86400},sportsbook:'Verification only',odds_american:110,stake_cents:100,notes:'',tags:[]}));
assert.ifError((await admin.from('customer_tracked_plays').insert(records)).error);
const body={action:'annotate',id:id+'0',notes:'Injury confirmed before tip-off',tags:['Injury news','My strategy']};
assert.equal((await call(a,body)).status,200);
assert.equal((await call(b,{...body,notes:'foreign overwrite',user_id:a.id})).status,404);
let response=await call(a);assert.equal(response.status,200);assert.equal(response.data.rows.length,2);assert.equal(response.data.rows.find(x=>x.id===id+'0').notes,body.notes);
response=await call(a,null,'?tag=Injury%20news');assert.equal(response.data.rows.length,1);assert.equal(response.data.summary.total,1);
response=await call(a,null,'?notes=CONFIRMED');assert.equal(response.data.rows.length,1);
assert.equal((await call(b)).data.rows.length,0);
response=await call(a,{action:'ask',question:'Summarize this view',filters:{tag:'Injury news'}});assert.match(response.data.answer,/1 tracked plays/);
response=await call(a,{action:'ask',question:'How did my Injury news bets do?',filters:{}});assert.match(response.data.answer,/1 tracked plays/);assert.match(response.data.answer,/Injury news/);
response=await call(a,{action:'ask',question:'Summarize my bets with notes containing "confirmed"',filters:{}});assert.match(response.data.answer,/1 tracked plays/);assert.match(response.data.answer,/confirmed/i);
assert.equal((await call(a,{...body,notes:'',tags:[]})).status,200);
response=await call(a);const cleared=response.data.rows.find(x=>x.id===id+'0');assert.equal(cleared.notes,'');assert.deepEqual(cleared.tags,[]);
console.log('PASS production: owner-scoped persistence, second-account isolation, tag/notes filtering, preset Ask, live LLM tag and literal-notes queries, clearing');
}finally{for(const client of clients)await client.auth.signOut({scope:'global'});for(const id of users){const result=await admin.auth.admin.deleteUser(id);assert.ifError(result.error);}console.log('Disposable verification accounts and their plays removed.');}})().catch(error=>{console.error(error.message);process.exitCode=1});
