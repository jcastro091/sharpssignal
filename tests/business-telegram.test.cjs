const {test}=require('node:test');const assert=require('node:assert/strict');
const {sendBusiness}=require('../lib/businessTelegram.cjs');
const env={BUSINESS_TELEGRAM_CHAT_ID:'-4',BUSINESS_TELEGRAM_MEMBER_IDS:'1,2',TELEGRAM_BOT_TOKEN:'test',PRO_CHAT_ID:'-1'};
function transport(count=2){const calls=[];return {calls,fetcher:async(url,req)=>{const method=url.split('/').pop();calls.push(method);const result=method==='getChat'?{type:'supergroup'}:method==='getChatMemberCount'?count:method==='getChatMember'?{status:'administrator'}:{message_id:10,chat:{id:-4}};return {ok:true,json:async()=>({ok:true,result})}}};}
test('private business delivery verifies all members and receipt',async()=>{const t=transport();assert.deepEqual(await sendBusiness('TEST—NO BET/NO TRADE',{env,...t}),{message_id:10});assert.equal(t.calls.at(-1),'sendMessage');assert.equal(t.calls.filter(x=>x==='getChatMember').length,2)});
test('changed membership blocks customer data before send',async()=>{const t=transport(3);await assert.rejects(sendBusiness('private',{env,...t}),/membership_changed/);assert.ok(!t.calls.includes('sendMessage'))});
test('customer channel cannot receive business notices',async()=>{const t=transport();await assert.rejects(sendBusiness('private',{env:{...env,BUSINESS_TELEGRAM_CHAT_ID:'-1'},...t}),/audience_overlap/);assert.equal(t.calls.length,0)});
