import {billingUser} from '../../../lib/billingServer';
const {verifiedQAGrant}=require('../../../lib/realtimeBilling.cjs');
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 const ctx=await billingUser(req,res);if(!ctx)return;
 if(process.env.QA_CHECKOUT_ENABLED!=='true'||ctx.user.id!==process.env.QA_CHECKOUT_USER_ID)return res.status(403).json({ok:false});
 try{const grant=await verifiedQAGrant(ctx.stripe,ctx.supabase,String(req.body?.session_id||''),ctx.user.id);
  return res.status(200).json({ok:true,paid:true,qa_test:true,expires_at:grant.valid_until});
 }catch{return res.status(409).json({ok:false,error:'payment_not_verified'});}
}
