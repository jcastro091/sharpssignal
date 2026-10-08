import {realtimeUser} from '../../lib/billingServer';
const {paidInvite}=require('../../lib/realtimeBilling.cjs');
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 const ctx=await realtimeUser(req,res);if(!ctx)return;
 try{
  const account=await ctx.supabase.from('telegram_accounts').select('telegram_user_id').eq('user_id',ctx.user.id).maybeSingle();
  if(account.error)throw new Error('telegram_link_unavailable');
  if(!account.data?.telegram_user_id)return res.status(409).json({ok:false,error:'telegram_link_required'});
  if(ctx.grant.qa_test)return res.status(403).json({ok:false,error:'verification_notifications_only'});
  const chatId=process.env.PRO_CHAT_ID;
  if(!chatId)return res.status(503).json({ok:false,error:'paid_channel_not_configured'});
  const url=await paidInvite({supabase:ctx.supabase,grant:ctx.grant,telegramUserId:account.data.telegram_user_id,chatId});
  return res.status(200).json({ok:true,url});
 }catch{return res.status(503).json({ok:false,error:'telegram_invite_unavailable'});}
}
