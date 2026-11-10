// Local integration: real Next page/API and Supabase client, fixture auth/database.
const {chromium}=require('playwright'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {publicationKey}=require('../lib/trackedPlays.cjs');
const origin='http://sharps.local.test:3018',now=Date.now(),user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',email_confirmed_at:new Date(now-86400000).toISOString()};
const token=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({...user,sub:user.id,exp:Math.floor(now/1000)+3600})).toString('base64url'),'fixture'].join('.');
const plays=[{entry_id:'fixture-umkc',cohort:'Original forward',play_key:'fixture-game-1',side:'UMKC Kangaroos',home:'Jacksonville Dolphins',away:'UMKC Kangaroos',market:'h2h',start:now/1000-86400},{entry_id:'fixture-scstate',cohort:'Original forward',play_key:'fixture-game-2',side:'South Carolina St Bulldogs',home:'Chicago St Cougars',away:'South Carolina St Bulldogs',market:'h2h',start:now/1000-86400}];
const stored=plays.map((p,i)=>({id:'fixture-'+i,user_id:user.id,play_key:publicationKey(p),snapshot:p,sportsbook:'Fixture book',odds_american:i?150:110,stake_cents:2500,created_at:new Date(now-90000000).toISOString()}));
let settled=true,rpcCalls=0,deleteCalls=0,failDelete=false;
const service=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');let body='';for await(const c of req)body+=c;
 if(req.method==='OPTIONS')return res.end();
 const u=new URL(req.url,'http://127.0.0.1:4018');
 if(u.pathname==='/auth/v1/user')return res.end(JSON.stringify(user));
 if(u.pathname==='/rest/v1/customer_tracked_plays' && req.method==='DELETE'){
  deleteCalls++;assert.equal(u.searchParams.get('user_id'),'eq.'+user.id);
  if(failDelete){res.statusCode=500;return res.end(JSON.stringify({message:'fixture database unavailable'}));}
  const id=u.searchParams.get('id').slice(3),index=stored.findIndex(r=>r.id===id&&u.searchParams.get('user_id')==='eq.'+r.user_id);
  const deleted=index<0?[]:stored.splice(index,1).map(r=>({id:r.id}));return res.end(JSON.stringify(deleted));
 }
 if(u.pathname==='/rest/v1/customer_tracked_plays'){
  assert.equal(u.searchParams.get('user_id'),'eq.'+user.id);return res.end(JSON.stringify(stored));
 }
 if(u.pathname==='/rest/v1/member_publication_settings')return res.end('[{"paused":false}]');
 if(u.pathname==='/rest/v1/rpc/tracked_play_results'){
  rpcCalls++;assert.deepEqual(JSON.parse(body).keys,stored.map(r=>r.play_key));
  return res.end(JSON.stringify(settled?plays.filter(p=>stored.some(r=>r.play_key===publicationKey(p))).map(p=>({play_key:publicationKey(p),payload:{...p,result:p.entry_id==='fixture-umkc'?'loss':'win',settlement_status:'verified_final_score'}})):[]));
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
  assert.equal(await page.locator('details').count(),2);
  await page.locator('details').first().locator('summary').click();
  const remove=page.getByRole('button',{name:/Delete play: UMKC/});
  page.once('dialog',d=>d.dismiss());await remove.click();assert.equal(deleteCalls,0);assert.equal(stored.length,2);
  failDelete=true;page.once('dialog',d=>d.accept());await remove.click();
  await page.getByRole('alert').filter({hasText:'Your tracked plays are temporarily unavailable.'}).waitFor();assert.equal(stored.length,2);assert.equal(await page.locator('details').count(),2);
  failDelete=false;page.once('dialog',d=>d.accept());await remove.click();
  await page.getByRole('status').filter({hasText:'Play deleted.'}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('details').length===1);
  assert.equal(stored.length,1);assert.equal(stored[0].snapshot.side,'South Carolina St Bulldogs');
  await page.clock.fastForward(60000);await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();
  assert.equal(await page.locator('details').count(),1);
  const net=page.locator('article').filter({has:page.getByText('Net profit',{exact:true})});assert.match(await net.innerText(),/\$37\.50/);
  await page.reload();await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();assert.equal(await page.locator('details').count(),1);
  await page.setViewportSize({width:390,height:844});await page.locator('details').first().locator('summary').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.getByRole('button',{name:/Delete play: South Carolina/}).count(),1);
  assert.deepEqual(errors,[]);console.log('PASS: confirmation cancellation, failed delete preserves row, confirmed owner-scoped deletion, totals recompute, reload and automatic refresh preserve deletion, mobile delete action fits');
 }catch(e){console.error(output.slice(-3000));throw e}finally{await browser?.close();app.kill('SIGTERM');service.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
