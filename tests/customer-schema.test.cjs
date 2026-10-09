const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_MODULE||'/tmp/sharpssignal-db-tests/node_modules/@electric-sql/pglite');
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
let db;
test.before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.role() returns text language sql as $$select current_user::text$$;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');`);
 const linkSchema=fs.readFileSync('supabase/migrations/202607070003_telegram_account_mapping.sql','utf8');
 await db.exec(linkSchema);
 await db.exec(fs.readFileSync('schema/customer-realtime-access.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261009213303_product_entitlements.sql','utf8'));
 await db.exec(fs.readFileSync(process.env.BACKEND_SCHEMA_PATH||'../sports/schema/customer-delayed-research.sql','utf8'));
});
test.after(async()=>{await db?.close();});
function grant(){const now=Date.now();return {stripe_session_id:'cs_live_qa',user_id:owner,billing_mode:'live',plan:'pro_telegram',status:'paid',stripe_payment_intent_id:'pi_qa',stripe_customer_id:'cus_qa',paid_at:new Date(now).toISOString(),valid_until:new Date(now+1800000).toISOString(),verified_at:new Date(now).toISOString(),qa_test:true,amount_cents:100,currency:'usd'};}
const apply=p=>db.query('select public.apply_customer_payment($1::jsonb) as payment_grant',[JSON.stringify(p)]);
test('payment replay preserves expiry and ownership; revoked grants cannot reactivate',async()=>{
 const p=grant();await apply(p);await apply({...p,verified_at:new Date(Date.now()+1).toISOString()});
 await assert.rejects(()=>apply({...p,valid_until:new Date(Date.parse(p.valid_until)+1000).toISOString()}));
 await assert.rejects(()=>apply({...p,user_id:other}));
 await db.exec("update customer_entitlements set status='revoked',revoked_at=now()");await assert.rejects(()=>apply(p));
});

test('product entitlements default legacy Sports and reject changed or invalid products',async()=>{
 const p={...grant(),stripe_session_id:'cs_live_products',stripe_payment_intent_id:'pi_products',products:['markets']};
 const result=await apply(p);assert.deepEqual(result.rows[0].payment_grant.products,['markets']);
 await assert.rejects(()=>apply({...p,products:['sports','markets']}));
 for(const products of [[],['operations'],['sports','sports']])await assert.rejects(()=>apply({...p,stripe_session_id:'cs_live_invalid',products}));
});
test('untrusted roles cannot read grants, source snapshots or execute payment/publication RPCs',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(()=>db.query('select * from customer_entitlements'));
  await assert.rejects(()=>db.query('select * from customer_research_versions'));
  await assert.rejects(()=>db.query("select customer_delayed_research('sports',1)"));
  await assert.rejects(()=>apply(grant()));await db.exec('reset role');
 }
});
test('publication versions delay changes, keep the earlier visible result, deduplicate and withdraw rejected plays',async()=>{
 const row={play_key:'play1',payload_hash:'old',payload:{entry_id:'entry1',result:'pending'},source_generated_at:new Date().toISOString()};
 const capture=rows=>db.query('select capture_customer_research($1,$2::jsonb)',['sports',JSON.stringify(rows)]);
 const read=()=>db.query("select * from customer_delayed_research('sports',30)");
 await capture([row]);assert.equal((await read()).rows.length,0);
 await db.exec("update customer_research_versions set seen_at=now()-interval '2 minutes';update customer_research_heads set active_since=now()-interval '3 minutes'");
 assert.equal((await db.query("select * from customer_delayed_research('sports',1)")).rows.length,0);
 await db.exec("update customer_research_versions set seen_at=now()-interval '31 minutes';update customer_research_heads set active_since=now()-interval '32 minutes'");
 await capture([{...row,payload_hash:'new',payload:{entry_id:'entry1',result:'win'}}]);
 assert.equal((await read()).rows[0].payload.result,'pending');
 await capture([{...row,payload_hash:'new',payload:{entry_id:'entry1',result:'win'}}]);
 assert.equal((await db.query('select count(*)::int n from customer_research_versions')).rows[0].n,2);
 await db.exec("update customer_research_versions set seen_at=now()-interval '30 minutes' where payload_hash='new'");
 assert.equal((await read()).rows[0].payload.result,'win');
 await capture([]);assert.equal((await read()).rows.length,0);
 await capture([row]);assert.equal((await read()).rows.length,0);
 assert.equal((await db.query('select count(*)::int n from customer_research_versions')).rows[0].n,3);
});
test('Telegram linking is private, one-use and cannot steal either account mapping',async()=>{
 await db.exec(`insert into telegram_link_codes(code,user_id,email,expires_at) values('1234ABCD','${owner}','owner@example.test',now()+interval '15 minutes'),('1234ABCE','${other}','other@example.test',now()+interval '15 minutes')`);
 const link=(code,tg,chat)=>db.query('select consume_customer_telegram_code($1,$2,$3,null) linked',[code,tg,chat]);
 assert.equal((await link('1234ABCD','123','-100')).rows[0].linked,false);
 assert.equal((await link('1234ABCD','123','123')).rows[0].linked,true);
 assert.equal((await link('1234ABCD','123','123')).rows[0].linked,false);
 assert.equal((await link('1234ABCE','123','123')).rows[0].linked,false);
});
