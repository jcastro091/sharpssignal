import {billingUser} from '../../../lib/billingServer';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
 const ctx=await billingUser(req,res);if(!ctx)return;
 if(process.env.QA_CHECKOUT_ENABLED!=='true'||ctx.user.id!==process.env.QA_CHECKOUT_USER_ID)
  return res.status(403).json({ok:false,error:'verification_checkout_not_enabled'});
 try{
  const origin=process.env.QA_CHECKOUT_ORIGIN||(process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:null);
  if(!origin||!/^https:\/\/[a-z0-9.-]+$/.test(origin))throw new Error('checkout_origin_unavailable');
  const metadata={user_id:ctx.user.id,plan:'qa_realtime',qa_test:'true',qa_run_id:process.env.QA_CHECKOUT_RUN_ID,utm_source:'qa_journey',utm_campaign:process.env.QA_CHECKOUT_RUN_ID};
  const session=await ctx.stripe.checkout.sessions.create({mode:'payment',customer_creation:'always',customer_email:ctx.user.email,
   line_items:[{price_data:{currency:'usd',unit_amount:100,product_data:{name:'SharpsSignal verification — $1, no renewal'}},quantity:1}],
   metadata,payment_intent_data:{metadata},success_url:origin+'/billing?session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/billing?cancelled=1'},
   {idempotencyKey:'qa-realtime-'+ctx.user.id+'-'+process.env.QA_CHECKOUT_RUN_ID});
  if(!session.livemode)throw new Error('unexpected_billing_mode');
  return res.status(200).json({ok:true,url:session.url,amount_cents:100,currency:'usd',qa_test:true,renewal:false});
 }catch{return res.status(503).json({ok:false,error:'verification_checkout_unavailable'});}
}
