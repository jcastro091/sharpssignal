const test=require("node:test"),assert=require("node:assert/strict");
const {audienceForUser,customerEvents}=require("../lib/measurementAudience.cjs");
const {summarizeLifecycle}=require("../lib/growthLifecycle.cjs");
const {summarize}=require("../lib/growthReport.cjs");
test("owner and QA browser activity before login is excluded after account identification",()=>{
 assert.equal(audienceForUser({id:"owner",email:"JCastro091@gmail.com",email_confirmed_at:"today"},{}),"owner");
 const rows=[{visitor_id:"v_owner",metadata:{}},{visitor_id:"v_owner",user_id:"owner",metadata:{audience:"owner",test:true}},{visitor_id:"v_customer",user_id:"customer",metadata:{audience:"customer"}}];
 assert.deepEqual(customerEvents(rows).map(e=>e.user_id),["customer"]);
 assert.deepEqual(customerEvents(rows,["customer"]),[]);
 assert.equal(audienceForUser({id:"qa",email_confirmed_at:"today"},{QA_CHECKOUT_USER_ID:"qa"}),"test");
});
test("customer account pages join across devices; owner payments and activity never count",()=>{
 const now=Date.parse("2026-11-02T00:00:00Z"),date=new Date(now-60000).toISOString();
 const event=(id,visitor,path)=>({event_name:"page_view",source:"web",created_at:date,page_path:path,visitor_id:visitor,user_id:id,metadata:{authenticated_account:"v1",revision:"2026-10-08-v1"}});
 const events=[event("customer","v_one","/dashboard"),event("customer","v_two","/billing"),event("owner","v_owner","/dashboard")];
 const evidence={accounts:[{id:"owner",qa_test:true}],statuses:{activity:"available",accounts:"available",payments:"available"}};
 const d=summarizeLifecycle(events,evidence,{now,since:new Date(now-86400000).toISOString()});
 assert.equal(d.account_usage.observed_accounts,1);
 assert.deepEqual(d.account_usage.pages,[{path:"/dashboard",accounts:1},{path:"/billing",accounts:1}]);
 const payment={id:"p",livemode:true,status:"complete",payment_status:"paid",amount_total:2000,mode:"subscription",created:now/1000,metadata:{plan:"pro_telegram",user_id:"owner"}};
 evidence.payments=[payment];
 assert.equal(summarizeLifecycle(events,evidence,{now,since:date}).offers.find(o=>o.key==="subscription").steps.at(-1).value,0);
 const report=summarize(events,[payment],{excluded_user_ids:["owner"]});
 assert.equal(report.payments.completed_checkouts,0);assert.equal(report.visitors,2);assert.equal(report.excluded_user_ids,undefined);
});
