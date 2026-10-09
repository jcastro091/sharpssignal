async function sendBusiness(text, {env=process.env, fetcher=fetch}={}) {
 const chat=String(env.BUSINESS_TELEGRAM_CHAT_ID||'').trim();
 const token=env.TELEGRAM_BOT_TOKEN||env.TG_BOT_TOKEN;
 const members=[...new Set(String(env.BUSINESS_TELEGRAM_MEMBER_IDS||'').split(',').filter(Boolean))];
 if(!token||!/^-[0-9]+$/.test(chat)||!members.length)throw Error('business_telegram_not_configured');
 if([env.PRO_CHAT_ID,env.MARKET_SHADOW_TELEGRAM_CHAT_ID,env.OPS_TELEGRAM_CHAT_ID].includes(chat))throw Error('telegram_audience_overlap');
 async function call(method,body){
  try {
   const r=await fetcher('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
   const result=await r.json();if(!r.ok||!result.ok)throw Error();return result.result;
  } catch {throw Error('business_telegram_request_failed');}
 }
 const info=await call('getChat',{chat_id:chat});
 if(!['group','supergroup'].includes(info.type)||info.username)throw Error('business_group_not_private');
 if(await call('getChatMemberCount',{chat_id:chat})!==members.length)throw Error('business_membership_changed');
 for(const id of members){const member=await call('getChatMember',{chat_id:chat,user_id:Number(id)});if(!['creator','administrator'].includes(member.status))throw Error('business_membership_changed');}
 const receipt=await call('sendMessage',{chat_id:chat,text,disable_web_page_preview:true});
 if(!receipt.message_id||String(receipt.chat?.id)!==chat)throw Error('business_delivery_unconfirmed');
 return {message_id:receipt.message_id};
}
module.exports={sendBusiness};
