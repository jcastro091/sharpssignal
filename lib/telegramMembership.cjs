const crypto=require('node:crypto');
const {refreshCustomerAccess,telegram}=require('./realtimeBilling.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function admissionAuthorized(req,key){
 if(!key)return false;
 const expected=Buffer.from(crypto.createHmac('sha256',key).update('sharpssignal-telegram-admission-v1').digest('hex'));
 const given=Buffer.from(String(req.headers?.['x-telegram-admission-token']||''));
 return given.length===expected.length&&crypto.timingSafeEqual(given,expected);
}
async function handleMembership(update,{stripe,supabase,chatId,send=telegram,now=Date.now()}){
 const message=update.message;
 const code=message?.chat?.type==='private'&&String(message.text||'').match(/^\/(?:link|start)(?:@\w+)?\s+([A-F0-9]{8})$/i);
 if(code){
  const linked=await supabase.rpc('consume_customer_telegram_code',{link_code:code[1].toUpperCase(),tg_user:String(message.from.id),tg_chat:String(message.chat.id),tg_username:message.from.username||null});
  if(linked.error)throw Error('telegram_link_unavailable');
  await send('sendMessage',{chat_id:message.chat.id,text:linked.data?'Your Telegram account is linked. Open Billing in your dashboard to request paid real-time access.':'That linking code is invalid or expired. Request a new code from your dashboard.'});
  return {handled:true,linked:Boolean(linked.data)};
 }
 const join=update.chat_join_request;
 if(!join||String(join.chat.id)!==String(chatId))return {handled:false};
 const url=join.invite_link?.invite_link;
 const found=url?await supabase.from('customer_telegram_invites').select('*').eq('invite_hash',hash(url)).maybeSingle():{data:null};
 if(found.error)throw Error('invite_storage_unavailable');
 const invite=found.data;
 const identity=invite&&!invite.used_at&&!invite.qa_test&&invite.telegram_user_id===String(join.from.id)&&invite.chat_id===String(chatId)&&Date.parse(invite.expires_at)>now;
 const grant=identity?await refreshCustomerAccess(stripe,supabase,invite.user_id,now):null;
 const paid=grant&&!grant.qa_test&&grant.stripe_session_id===invite.stripe_session_id;
 if(!paid){await send('declineChatJoinRequest',{chat_id:chatId,user_id:join.from.id});return {handled:true,admitted:false};}
 const recorded=await supabase.from('customer_telegram_memberships').upsert({user_id:invite.user_id,telegram_user_id:String(join.from.id),chat_id:String(chatId),stripe_session_id:grant.stripe_session_id,status:'pending',updated_at:new Date(now).toISOString()},{onConflict:'chat_id,telegram_user_id'});
 if(recorded.error)throw Error('membership_storage_unavailable');
 await send('approveChatJoinRequest',{chat_id:chatId,user_id:join.from.id});
 const saved=await supabase.from('customer_telegram_memberships').update({status:'active'}).eq('chat_id',String(chatId)).eq('telegram_user_id',String(join.from.id));
 if(saved.error)throw Error('membership_receipt_unavailable');
 const used=await supabase.from('customer_telegram_invites').update({used_at:new Date(now).toISOString()}).eq('invite_hash',invite.invite_hash);
 if(used.error)throw Error('invite_receipt_unavailable');
 await send('revokeChatInviteLink',{chat_id:chatId,invite_link:url});
 return {handled:true,admitted:true};
}
async function reconcileMemberships({stripe,supabase,send=telegram,now=Date.now()}){
 const members=await supabase.from('customer_telegram_memberships').select('*').in('status',['active','pending']);
 if(members.error)throw Error('membership_storage_unavailable');
 let revoked=0,errors=0;
 for(const member of members.data||[]){
  let grant;
  try{grant=await refreshCustomerAccess(stripe,supabase,member.user_id,now);}catch{errors++;continue;}
  if(grant&&!grant.qa_test&&grant.stripe_session_id===member.stripe_session_id)continue;
  try{
   await send('banChatMember',{chat_id:member.chat_id,user_id:member.telegram_user_id,revoke_messages:false});
   await send('unbanChatMember',{chat_id:member.chat_id,user_id:member.telegram_user_id,only_if_banned:true});
   const saved=await supabase.from('customer_telegram_memberships').update({status:'revoked',updated_at:new Date(now).toISOString()}).eq('chat_id',member.chat_id).eq('telegram_user_id',member.telegram_user_id);
   if(saved.error)throw Error();revoked++;
  }catch{errors++;}
 }
 return {checked:members.data?.length||0,revoked,errors};
}
module.exports={admissionAuthorized,handleMembership,reconcileMemberships};
