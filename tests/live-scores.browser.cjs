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
  // Render fixtures test display only; provider matching/freshness is tested separately.
  let scoreRequests=0,failRefresh=false,spreadMode=false,coverageSport=null,coverageMarket=null;
  const {modelProbability}=require('../lib/liveProbability.cjs');
  await page.route('**/api/tracked-plays?*',async route=>{scoreRequests++;if(failRefresh)return route.fulfill({status:503,json:{ok:false,error:'fixture unavailable'}});const response=await route.fetch({url:route.request().url().replace('sharps.local.test','127.0.0.1')});const body=await response.json();body.rows=body.rows.map((row,i)=>{const play=i?{...row.play,sport:'basketball_ncaab'}:{...row.play,sport:'basketball_ncaab',market:spreadMode?'spreads':'totals',side:spreadMode?row.play.home:'Over',point:spreadMode?4:150.5};if(!i&&coverageSport){play.sport=coverageSport;play.market=coverageMarket;play.side=coverageMarket==='totals'?'Over':play.home;play.point=coverageMarket==='totals'?150.5:4;}const game={date:new Date(play.start*1000).toISOString(),seasonType:2,status:coverageSport==='baseball_mlb'?{type:{state:'in',detail:'Top 7th'},period:7}:{type:{state:'in'},period:2,displayClock:'4:12'},situation:coverageSport==='baseball_mlb'?{outs:1,onFirst:false,onSecond:true,onThird:false}:{possession:'H',down:1,distance:10},competitors:[{id:'H',homeAway:'home',score:'60',team:{displayName:play.home}},{id:'A',homeAway:'away',score:String(64+scoreRequests),team:{displayName:play.away}}]};return {...row,play,live:{state:'in',status:'4:12 - 2nd',away:play.away,home:play.home,away_score:64+scoreRequests,home_score:60,checked_at:new Date().toISOString(),source:'ESPN',probability:i&&!spreadMode?{win:.63,lose:.37,tie:0,as_of:new Date().toISOString(),source:'ESPN game-win model'}:modelProbability(play,game,Date.now(),Date.now())}};});await route.fulfill({response,json:body});});
  await page.goto(origin+'/my-plays');await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();
  assert.equal(await page.locator('details:has(> summary strong)').count(),2);
  assert.match(await page.locator('details:has(> summary strong)').first().locator('summary').innerText(),/Current total: 125/);
  assert.match(await page.locator('details:has(> summary strong)').first().locator('summary').innerText(),/Win chance/);
  assert.match(await page.locator('details:has(> summary strong)').nth(1).locator('summary').innerText(),/Win chance\s+63.0%/);
  assert.match(await page.locator('details:has(> summary strong)').nth(1).locator('summary').innerText(),/ESPN game-win model/);
  const initialRequests=scoreRequests;
  await page.clock.fastForward(60000);
  await page.getByText(/Current total: 126/).waitFor();
  assert.equal(scoreRequests,initialRequests+1);
  failRefresh=true;await page.clock.fastForward(60000);
  await page.getByRole('alert').filter({hasText:'Showing the last update'}).waitFor();
  assert.equal(await page.locator('details:has(> summary strong)').count(),2);
  assert.match(await page.locator('details:has(> summary strong)').first().innerText(),/Current total: 126/);
  failRefresh=false;await page.clock.fastForward(60000);
  await page.getByText(/Current total: 128/).waitFor();
  assert.equal(await page.getByRole('alert').filter({hasText:'Showing the last update'}).count(),0);
  spreadMode=true;await page.getByRole('button',{name:'Refresh results',exact:true}).click();
  await page.getByText(/Cover chance/).waitFor();
  assert.doesNotMatch(await page.locator('details:has(> summary strong)').first().locator('summary').innerText(),/Lose|Push|Estimate, not a guarantee/);
  assert.match(await page.locator('details:has(> summary strong)').first().locator('summary').innerText(),/Experimental/);
  assert.match(await page.locator('details:has(> summary strong)').nth(1).locator('summary').innerText(),/SharpsSignal/);
  for(const sport of require('../lib/liveProbability.cjs').supportedModelSports){for(const market of ['h2h','spreads','totals']){coverageSport=sport;coverageMarket=market;const loaded=page.waitForResponse(response=>response.url().includes('/api/tracked-plays?'));await page.getByRole('button',{name:'Refresh results',exact:true}).click();await loaded;await page.getByRole('button',{name:'Refresh results',exact:true}).waitFor();const summary=page.locator('details:has(> summary strong)').first().locator('summary');assert.match(await summary.innerText(),market==='spreads'?/Cover chance/:/Win chance/);assert.ok(await summary.locator('[class*=probability]>b').innerText());}}
  const desktopCards=page.locator('details:has(> summary strong)');const left=await desktopCards.first().boundingBox(),right=await desktopCards.nth(1).boundingBox();assert.ok(right.x>=left.x+left.width);assert.ok(Math.abs(left.y-right.y)<2);await desktopCards.first().locator('..').screenshot({path:'out/bet-grid-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const firstMobile=await desktopCards.first().boundingBox(),secondMobile=await desktopCards.nth(1).boundingBox();assert.ok(secondMobile.y>=firstMobile.y+firstMobile.height);
  const layout=await page.locator('details:has(> summary strong)').first().locator('summary').evaluate(summary=>{const box=summary.querySelector('[class*=liveScore]'),teams=box.querySelectorAll('[class*=scoreTeams] b'),probability=box.querySelector('[class*=probability]>b');const terms=summary.querySelectorAll('[class*=betTerms]>span');return {metricsRight:box.querySelector('[class*=scoreMetrics]').getBoundingClientRect().left>teams[0].getBoundingClientRect().left,termsStacked:terms[1].getBoundingClientRect().top>=terms[0].getBoundingClientRect().bottom,stacked:teams[1].getBoundingClientRect().top>=teams[0].getBoundingClientRect().bottom,scoreWeight:Number(getComputedStyle(teams[0]).fontWeight),scoreSize:parseFloat(getComputedStyle(teams[0]).fontSize),chanceSize:parseFloat(getComputedStyle(probability).fontSize)};});
  assert.ok(layout.stacked);assert.ok(layout.metricsRight);assert.ok(layout.termsStacked);assert.ok(layout.scoreWeight>=700);assert.ok(layout.chanceSize>layout.scoreSize);
  await page.getByRole('button',{name:'No thanks',exact:true}).click().catch(()=>{});
  await page.locator('details:has(> summary strong)').first().screenshot({path:'out/live-score-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS: collapsed live scores, totals progress, experimental totals/spreads with push and moneyline fallback, sourced moneyline win/loss estimate, mobile fit, no page errors');
 }catch(e){console.error(output.slice(-3000));throw e}finally{await browser?.close();app.kill('SIGTERM');service.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
