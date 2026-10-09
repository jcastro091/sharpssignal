const {grantProducts}=require('../../lib/productAccess.cjs');
import {billingUser} from '../../lib/billingServer';
const {refreshCustomerGrants}=require('../../lib/realtimeBilling.cjs');
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const ctx=await billingUser(req,res);if(!ctx)return;
 try{const grants=await refreshCustomerGrants(ctx.stripe,ctx.supabase,ctx.user.id);
  const products=[...new Set(grants.filter(g=>!g.qa_test||ctx.user.id===process.env.QA_CHECKOUT_USER_ID).flatMap(grantProducts))];
  return res.status(200).json({ok:true,realtime:products.length>0,products,delay_minutes:products.length?0:30,qa_test:grants.some(g=>g.qa_test)});
 }catch{return res.status(503).json({ok:false,realtime:false,error:'payment_verification_unavailable'});}
}
