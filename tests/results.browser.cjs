const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {normalizeSlip,summary}=require('../lib/sportsbookResults.cjs');
const {insights,filterSlips,answer}=require('../lib/betInsights.cjs');
const base='http://127.0.0.1:3027';
const slips=[
 {id:'SLIP_example_one',book:{name:'FanDuel'},type:'single',status:'completed',outcome:'loss',atRisk:2500,netProfit:-2500,bookRef:'FD-example-001',oddsAmerican:-110,timePlaced:'2026-10-10T17:00:00Z',bets:[{id:'leg_1',bookDescription:'Buffalo -3.5',event:{name:'Buffalo at New York',league:'NFL'},proposition:'spread',line:-3.5,oddsAmerican:-110}]},
 {id:'SLIP_example_two',book:{name:'DraftKings'},type:'single',status:'completed',outcome:'win',atRisk:2000,netProfit:1800,timePlaced:'2026-10-10T20:00:00Z',bets:[{bookDescription:'Over 45.5',proposition:'total',event:{league:'NFL'}}]},
 {id:'SLIP_example_three',book:{name:'FanDuel'},type:'parlay',status:'pending',atRisk:1000,timePlaced:'2026-10-11T14:00:00Z',bets:[{bookDescription:'Kansas City moneyline'},{bookDescription:'Detroit moneyline'}]}
].map(normalizeSlip);
(async()=>{
 fs.mkdirSync('out/results-review',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const payload={sub:'00000000-0000-0000-0000-000000000001',exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'};
 const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.fixture';
 await context.addCookies([{name:'sb-127-auth-token',value:encodeURIComponent(JSON.stringify([token,'local-refresh',null,null,[]])),url:base}]);
 let fail=false;
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
  if(u.pathname==='/api/sportsbook-results'){
   if(fail)return route.fulfill({status:503,json:{error:'Provider unavailable for test'}});
   if(u.searchParams.get('view')==='configuration')return route.fulfill({json:{mode:'sandbox',configured:true}});
   const body=route.request().method()==='POST'?route.request().postDataJSON():null;
   const subset=filterSlips(slips,body?.filters||Object.fromEntries(u.searchParams));
   if(body?.action==='ask')return route.fulfill({json:{mode:'sandbox',...answer({dimension:'book',direction:'worst',metric:'profit'},subset),sampleCount:subset.length}});
   return route.fulfill({json:{mode:'sandbox',configured:true,accounts:[{id:'BACT_example',book:'FanDuel',verified:true}],slips:subset,summary:summary(subset),analytics:insights(subset),options:{books:['FanDuel','DraftKings'],markets:['spread','total','parlay']},fetchedAt:'2026-10-11T19:00:00Z',pagesRead:1,totalPages:1,limited:false}});
  }
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
  return route.continue();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/results');await page.getByRole('heading',{name:'Every book. One view.'}).waitFor();
 await page.getByRole('heading',{name:'Bet slips',exact:true}).waitFor();
 assert(await page.getByText('Sandbox · test data only').isVisible());
 if(await page.getByRole('button',{name:'No thanks',exact:true}).count())await page.getByRole('button',{name:'No thanks',exact:true}).click();
 await page.getByText('View bet slip',{exact:true}).first().click();
 await page.getByText('FD-example-001').waitFor();
 await page.getByRole('button',{name:'What sportsbooks am I losing with the most?'}).click();
 await page.getByText(/FanDuel has the lowest net result/).waitFor();
 assert((await page.getByText(/FanDuel has the lowest net result/).innerText()).includes('-$25.00'));
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:'out/results-review/desktop.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.getByLabel('Sportsbook',{exact:true}).selectOption('FanDuel');await page.getByRole('button',{name:'Apply filters'}).click();
 await page.getByText('2 slips · Retrieved',{exact:false}).waitFor();
 assert.equal(await page.getByText(/FanDuel has the lowest net result/).count(),0);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'out/results-review/mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 fail=true;await page.getByRole('button',{name:'Reload history'}).click();await page.getByRole('alert').filter({hasText:'Provider unavailable for test'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Bet slips',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({desktop:true,mobile:true,receipts:true,filters:true,question:true,failedLoadClearsReceipts:true,browserErrors:errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
