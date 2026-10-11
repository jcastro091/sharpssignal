// Run only from a trusted runner. Auth material stays in memory; no screenshots/traces.
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='https://www.sharps-signal.com';
async function main(){
 const report={origin,checks:[],stripe_refund_verified:false};
 let browser,session;
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE;
 assert(url?.includes('npoanpbmkglupulcklcg')&&key,'active_supabase_credentials_required');
 const auth=async(path,body)=>{const r=await fetch(url+'/auth/v1/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert(r.ok,'auth_setup_failed');return d;};
 try {
 browser=await chromium.launch({headless:true});
 let context=await browser.newContext();let page=await context.newPage();
 const denied=await context.request.get(origin+'/api/admin/pick-refunds');assert.equal(denied.status(),403);report.checks.push('anonymous API denied');
 await page.goto(origin+'/admin/refunds');assert(page.url().includes('/signin'));report.checks.push('anonymous screen redirects to sign-in');
 await context.close();
 const link=await auth('admin/generate_link',{type:'magiclink',email:'sharpssignal@gmail.com'});
 session=await auth('verify',{type:'magiclink',token_hash:link.hashed_token});
 for(const token of [session.access_token,session.refresh_token])console.log('::add-mask::'+token);
 context=await browser.newContext();
 const value=encodeURIComponent(JSON.stringify([session.access_token,session.refresh_token,null,null,null]));
 const name='sb-npoanpbmkglupulcklcg-auth-token';
 const chunks=[];for(let i=0;i<value.length;i+=3180)chunks.push(value.slice(i,i+3180));
 await context.addCookies(chunks.map((value,i)=>({name:chunks.length===1?name:name+'.'+i,value,url:origin,secure:true,sameSite:'Lax'})));
 page=await context.newPage();await page.goto(origin+'/admin/refunds');await page.getByRole('heading',{name:'Pick fee refunds',exact:true}).waitFor();report.checks.push('verified admin screen loads');
 const modeResponse=page.waitForResponse(r=>r.url().includes('/api/admin/pick-refunds?mode=test'));
 await page.getByRole('combobox').selectOption('test');
 const response=await modeResponse;
 const data=await response.json();assert.equal(response.status(),200);report.checks.push('authenticated browser API reads live database');
 const forged=await context.request.post(origin+'/api/admin/pick-refunds',{headers:{Origin:'https://untrusted.example'},data:{mode:'test',action:'test_purchase'}});assert.equal(forged.status(),403);report.checks.push('cross-origin mutation denied');
 if(!data.configured){report.blocker='STRIPE_TEST_SECRET_KEY missing';await page.getByRole('alert').filter({hasText:'Configure STRIPE_TEST_SECRET_KEY'}).waitFor();report.checks.push('sandbox creation disabled without separate test key');}
 else {
 const resultPromise=page.waitForResponse(r=>r.url().endsWith('/api/admin/pick-refunds')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Create sandbox purchase',exact:true}).click();const result=await(await resultPromise).json();assert(result.purchase_id);report.purchase_id=result.purchase_id;
 const row=page.getByRole('listitem').filter({hasText:'sandbox-loss:'+result.purchase_id});await row.getByRole('button',{name:'Preview refund',exact:true}).click();await page.getByRole('heading',{name:'Confirm pick fee refund'}).waitFor();
 const refundPromise=page.waitForResponse(r=>r.url().endsWith('/api/admin/pick-refunds')&&r.request().method()==='POST');await page.getByRole('button',{name:'Confirm refund',exact:true}).click();const refund=await(await refundPromise).json();assert.equal(refund.status,'succeeded');assert.equal(refund.amount_cents,500);report.stripe_refund_id=refund.stripe_refund_id;
 const repeat=await context.request.post(origin+'/api/admin/pick-refunds',{headers:{Origin:origin},data:{mode:'test',action:'refund',purchase_id:result.purchase_id}});const replay=await repeat.json();assert.equal(replay.stripe_refund_id,refund.stripe_refund_id);
 const h={apikey:key,Authorization:'Bearer '+key};
 const purchase=await(await fetch(url+'/rest/v1/pick_fee_purchases?id=eq.'+result.purchase_id,{headers:h})).json();assert.equal(purchase[0].status,'refunded');
 const events=await(await fetch(url+'/rest/v1/pick_fee_refund_events?purchase_id=eq.'+result.purchase_id,{headers:h})).json();assert.equal(events.filter(e=>e.event_type==='refund_succeeded').length,1);
 report.stripe_refund_verified=true;report.checks.push('Stripe sandbox $5 payment -> browser confirmation -> $5 refund -> persisted ledger and audit -> duplicate replay creates no extra refund');
 }
 await context.close();
 }finally{
 if(session?.access_token)await fetch(url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token}});
 if(browser)await browser.close();
 fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/deployed-refund-e2e.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }
}
main().catch(()=>{console.error('deployed_refund_e2e_failed');process.exitCode=1});
