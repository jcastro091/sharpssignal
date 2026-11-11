// Local integration: real Next page/API and Supabase client, fixture auth/database.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
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
 if(u.pathname==='/rest/v1/customer_tracked_plays' && req.method==='PATCH'){
  assert.equal(u.searchParams.get('user_id'),'eq.'+user.id);
  if(failDelete){res.statusCode=500;return res.end(JSON.stringify({message:'fixture save failed'}));}
  const row=stored.find(r=>u.searchParams.get('id')==='eq.'+r.id);const patch=JSON.parse(body);assert.deepEqual(Object.keys(patch).sort(),['notes','tags']);if(row)Object.assign(row,patch);return res.end(JSON.stringify(row?[{id:row.id,notes:row.notes,tags:row.tags}]:[]));
 }
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
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP sharps.local.test 127.0.0.1']});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addCookies([{name:'sb-127-auth-token',value:JSON.stringify([token,'local-test',null,null,null]),domain:'sharps.local.test',path:'/'}]);
  const page=await context.newPage();await page.clock.install();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/my-plays');await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();
  assert.equal(await page.locator('details').count(),2);
  const slip=page.locator('details').first();await slip.locator('summary').click();
  await slip.getByRole('button',{name:'Add notes and tags',exact:true}).click();
  await slip.getByLabel('Notes',{exact:true}).fill('Injury confirmed before tip-off');
  await slip.getByRole('button',{name:'Injury news',exact:true}).click();
  await slip.getByLabel('Custom tag',{exact:true}).fill('My strategy');await slip.getByRole('button',{name:'Add tag',exact:true}).click();
  failDelete=true;await slip.getByRole('button',{name:'Save notes',exact:true}).click();await slip.getByRole('alert').waitFor();assert.equal(await slip.getByLabel('Notes',{exact:true}).inputValue(),'Injury confirmed before tip-off');assert.equal(stored[0].notes,undefined);
  failDelete=false;await slip.getByRole('button',{name:'Save notes',exact:true}).click();await page.getByRole('status').filter({hasText:'Notes and tags saved.'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('summary').textContent.includes('My strategy'));
  assert.equal(stored[0].notes,'Injury confirmed before tip-off');assert.deepEqual(stored[0].tags,['Injury news','My strategy']);
  await page.reload();await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();
  const filters=page.getByRole('region',{name:'Filter by notes and tags'});await filters.getByRole('button',{name:'Injury news',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('details').length===1);
  assert.match(await page.locator('details summary').innerText(),/UMKC/);
  await page.getByRole('button',{name:'Summarize this view',exact:true}).click();await page.getByRole('button',{name:'Ask',exact:true}).click();
  await page.getByRole('status').filter({hasText:'1 tracked plays'}).waitFor();assert.match(await page.getByRole('status').filter({hasText:'1 tracked plays'}).innerText(),/-\$25.00/);
  await filters.getByRole('button',{name:'All tags',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('details').length===2);
  await page.getByLabel('Search your notes',{exact:true}).fill('CONFIRMED');await page.waitForFunction(()=>document.querySelectorAll('details').length===1);
  await page.getByLabel('Search your notes',{exact:true}).fill('missing text');await page.waitForFunction(()=>document.querySelectorAll('details').length===0);
  await filters.getByRole('button',{name:'Clear notes and tag filters',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('details').length===2);
  await page.locator('details').first().locator('summary').click();
  await page.locator('details').first().getByRole('button',{name:'Edit notes and tags',exact:true}).click();
  await page.locator('details').first().getByLabel('Notes',{exact:true}).fill('Unsaved draft');await page.locator('details').first().getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(stored[0].notes,'Injury confirmed before tip-off');
  await page.locator('details').first().getByRole('button',{name:'Edit notes and tags',exact:true}).click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'out/my-plays-notes-mobile.png',fullPage:true});
  await page.locator('details').first().getByLabel('Notes',{exact:true}).fill('');for(const tag of ['Injury news','My strategy'])await page.locator('details').first().getByRole('button',{name:tag,exact:true}).click();
  await page.locator('details').first().getByRole('button',{name:'Save notes',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('summary').textContent.includes('My strategy'));assert.deepEqual(stored[0].tags,[]);assert.equal(stored[0].notes,'');
  assert.deepEqual(errors,[]);console.log('PASS: real page + API + Supabase client: suggested/custom tags, failed-save draft preserved, persistence/reload, tag and notes filters, scoped Ask, cancel, clear, and mobile layout');
 }catch(e){console.error(output.slice(-3000));throw e}finally{await browser?.close();app.kill('SIGTERM');service.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
