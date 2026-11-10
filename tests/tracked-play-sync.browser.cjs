// Local integration: real Next page/API and Supabase client, fixture auth/database.
const {chromium}=require('playwright'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {publicationKey}=require('../lib/trackedPlays.cjs');
const origin='http://sharps.local.test:3018',now=Date.now(),user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',email_confirmed_at:new Date(now-86400000).toISOString()};
const token=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({...user,sub:user.id,exp:Math.floor(now/1000)+3600})).toString('base64url'),'fixture'].join('.');
const plays=[{entry_id:'fixture-umkc',cohort:'Original forward',play_key:'fixture-game-1',side:'UMKC Kangaroos',home:'Jacksonville Dolphins',away:'UMKC Kangaroos',market:'h2h',start:now/1000-86400},{entry_id:'fixture-scstate',cohort:'Original forward',play_key:'fixture-game-2',side:'South Carolina St Bulldogs',home:'Chicago St Cougars',away:'South Carolina St Bulldogs',market:'h2h',start:now/1000-86400}];
const stored=plays.map((p,i)=>({id:'fixture-'+i,user_id:user.id,play_key:publicationKey(p),snapshot:p,sportsbook:'Fixture book',odds_american:i?150:110,stake_cents:2500,created_at:new Date(now-90000000).toISOString()}));
let settled=false,rpcCalls=0;
const service=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');let body='';for await(const c of req)body+=c;
 if(req.method==='OPTIONS')return res.end();
 const u=new URL(req.url,'http://127.0.0.1:4018');
 if(u.pathname==='/auth/v1/user')return res.end(JSON.stringify(user));
 if(u.pathname==='/rest/v1/customer_tracked_plays'){
  assert.equal(u.searchParams.get('user_id'),'eq.'+user.id);return res.end(JSON.stringify(stored));
 }
 if(u.pathname==='/rest/v1/member_publication_settings')return res.end('[{"paused":false}]');
 if(u.pathname==='/rest/v1/rpc/tracked_play_results'){
  rpcCalls++;assert.deepEqual(JSON.parse(body).keys,stored.map(r=>r.play_key));
  return res.end(JSON.stringify(settled?plays.map((p,i)=>({play_key:publicationKey(p),payload:{...p,result:i?'win':'loss',settlement_status:'verified_final_score'}})):[]));
 }
 res.end('[]');
});
(async()=>{
 await new Promise(r=>service.listen(4018,'127.0.0.1',r));
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3018'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4018',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-key',SUPABASE_SERVICE_ROLE:'local-service-key'},stdio:['ignore','pipe','pipe']});let output='';app.stdout.on('data',x=>output+=x);app.stderr.on('data',x=>output+=x);
 let browser;
 try{
  for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:3018/signin');break}catch{}await new Promise(r=>setTimeout(r,200))}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP sharps.local.test 127.0.0.1']});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addCookies([{name:'sb-127-auth-token',value:JSON.stringify([token,'local-test',null,null,null]),domain:'sharps.local.test',path:'/'}]);
  const page=await context.newPage();await page.clock.install();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/my-plays');await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();
  assert.equal(await page.locator('details').count(),2);assert.equal(await page.locator('details summary').filter({hasText:'pending'}).count(),2);
  const initialCalls=rpcCalls;settled=true;await page.clock.fastForward(60000);
  await page.locator('details summary').filter({hasText:'loss'}).waitFor();await page.locator('details summary').filter({hasText:'win'}).waitFor();assert.ok(rpcCalls>initialCalls);
  assert.match(await page.locator('details').first().innerText(),/-\$25\.00/);assert.match(await page.locator('details').nth(1).innerText(),/\$37\.50/);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS: authenticated page → owner-scoped API → result lookup → automatic minute refresh → both grades and own-odds P&L; no manual refresh; narrow screen fits');
 }catch(e){console.error(output.slice(-3000));throw e}finally{await browser?.close();app.kill('SIGTERM');service.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
