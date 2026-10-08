const test=require('node:test'),assert=require('node:assert/strict');
const {telegramDestination}=require('../lib/telegramDestination.cjs');
test('identity verification resolves the configured private Pro channel administrator',async()=>{
 const replies={getChat:{type:'channel',title:'SharpsSignal Pro'},getMe:{id:42,is_bot:true,username:'ConfiguredProAdmin'},getChatMember:{status:'administrator',can_invite_users:true,can_restrict_members:true}};
 const calls=[];const send=async(method,body)=>{calls.push([method,body]);return replies[method];};
 assert.deepEqual(await telegramDestination('pro-channel',send),{channel_name:'SharpsSignal Pro',bot_username:'ConfiguredProAdmin'});
 assert.equal(calls[0][1].chat_id,'pro-channel');assert.deepEqual(calls[2][1],{chat_id:'pro-channel',user_id:42});
 for(const [field,value] of [['status','member'],['can_invite_users',false],['can_restrict_members',false]]){const prior=replies.getChatMember[field];replies.getChatMember[field]=value;await assert.rejects(()=>telegramDestination('pro-channel',send));replies.getChatMember[field]=prior;}
 replies.getChat.username='public';await assert.rejects(()=>telegramDestination('pro-channel',send));
 await assert.rejects(()=>telegramDestination('',send));
});
