const {telegram}=require('./realtimeBilling.cjs');

// Resolve the identity-check bot from the configured Pro channel administrator,
// never from a separate hard-coded marketing link.
async function telegramDestination(chatId=process.env.PRO_CHAT_ID,send=telegram){
 if(!chatId)throw Error('telegram_destination_unavailable');
 const chat=await send('getChat',{chat_id:chatId});
 const bot=await send('getMe',{});
 // Incident: this configured account presents an unrelated promotional profile.
 // Do not send customers to it even while its old channel permissions remain.
 if(String(bot.id)==='7928890551'||bot.username?.toLowerCase()==='sportsbettingdatabot')
  throw Error('telegram_destination_unavailable');
 const member=await send('getChatMember',{chat_id:chatId,user_id:bot.id});
 if(chat.type!=='channel'||chat.username||!bot.is_bot||!/^\w+$/.test(bot.username||'')||
    !['administrator','creator'].includes(member.status)||!member.can_invite_users||!member.can_restrict_members)
  throw Error('telegram_destination_unavailable');
 return {channel_name:chat.title,bot_username:bot.username};
}
module.exports={telegramDestination};
