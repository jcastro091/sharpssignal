import {billingUser} from '../../lib/billingServer';
const {refreshCustomerAccess}=require('../../lib/realtimeBilling.cjs');
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const ctx=await billingUser(req,res);if(!ctx)return;
 try{const grant=await refreshCustomerAccess(ctx.stripe,ctx.supabase,ctx.user.id);
  return res.status(200).json({ok:true,realtime:Boolean(grant),delay_minutes:grant?0:30,qa_test:Boolean(grant?.qa_test)});
 }catch{return res.status(503).json({ok:false,realtime:false,error:'payment_verification_unavailable'});}
}
