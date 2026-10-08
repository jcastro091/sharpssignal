import Stripe from 'stripe';
import {createSupabaseServiceClient} from '../../lib/supabaseServer';
const {admissionAuthorized,handleMembership,reconcileMemberships}=require('../../lib/telegramMembership.cjs');
export default async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 if(!admissionAuthorized(req,process.env.SUPABASE_SERVICE_ROLE||process.env.SUPABASE_SERVICE_ROLE_KEY))return res.status(401).json({ok:false});
 try{const deps={stripe:new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2025-06-30.basil',timeout:10000,maxNetworkRetries:0}),supabase:createSupabaseServiceClient(),chatId:process.env.PRO_CHAT_ID};
  const result=req.body?.reconcile===true?await reconcileMemberships(deps):await handleMembership(req.body,deps);
  return res.status(result.errors?503:200).json({ok:!result.errors,...result});
 }catch{return res.status(503).json({ok:false,error:'telegram_admission_unavailable'});}
}
