const {grantProducts}=require('../../lib/productAccess.cjs');
import {billingUser} from '../../lib/billingServer';
const {refreshCustomerGrants}=require('../../lib/realtimeBilling.cjs');
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const ctx=await billingUser(req,res);if(!ctx)return;
 try{
  const grants=await refreshCustomerGrants(ctx.stripe,ctx.supabase,ctx.user.id);
  const grant=grants[0];
  const paidProducts=[...new Set(grants.filter(g=>!g.qa_test).flatMap(grantProducts))];
  const account=await ctx.supabase.from('telegram_accounts').select('telegram_user_id').eq('user_id',ctx.user.id).maybeSingle();
  if(account.error)throw Error();
  return res.json({ok:true,paid:paidProducts.length>0,products:paidProducts,qa_test:Boolean(grant?.qa_test),telegram_linked:Boolean(account.data?.telegram_user_id),expires_at:grant?.valid_until||null});
 }catch{return res.status(503).json({ok:false,error:'payment_verification_unavailable'});}
}
