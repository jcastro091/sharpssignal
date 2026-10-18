// Local built app only; all shop reads mocked, no payment or external communication.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();let state='stall';
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.host!=='127.0.0.1:3035')return route.abort();
   if(url.pathname==='/api/pick-shop'){
    if(state==='stall')return;
    if(state==='error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'pick_shop_unavailable'})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({offers:[],recent_plays:[],orders:[],configured:false,live_sales_enabled:false})});
   }
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
   return route.continue();
  });
  await page.goto('http://127.0.0.1:3035/pick-shop');
  await page.getByText('Loading recent plays…',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Try again',exact:true}).waitFor({timeout:16000});
  assert.equal(await page.getByText('Loading recent plays…',{exact:true}).count(),0);
  assert.equal(await page.getByText('0 recent plays',{exact:true}).count(),0);
  await page.getByText('Purchasing is unavailable until availability is confirmed.',{exact:true}).waitFor();
  state='error';await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.getByRole('alert').waitFor();assert.equal(await page.getByText('Loading recent plays…',{exact:true}).count(),0);
  state='ready';await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.getByText('No picks recorded in the last 72 hours.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).count(),0);
  await page.getByText('Public per-pick checkout is not open yet.',{exact:true}).waitFor();
  console.log('PASS: stalled read → timeout/retry; 503 → error without spinner/false zero; retry → recovered empty state; sales remain closed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
