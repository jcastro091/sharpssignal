import {billingUser} from '../../../lib/billingServer';
export default async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 const ctx=await billingUser(req,res);if(!ctx)return;
 if(process.env.PAID_CHECKOUT_ENABLED!=='true')return res.status(403).json({ok:false,error:'paid_checkout_not_enabled'});
 try{
  const price=process.env.STRIPE_PRICE_PRO_TELEGRAM,origin=process.env.CHECKOUT_ORIGIN;
  if(!price||!/^https:\/\/[a-z0-9.-]+$/.test(origin||''))throw Error();
  const metadata={user_id:ctx.user.id,plan:'pro_telegram'};
  const session=await ctx.stripe.checkout.sessions.create({mode:'subscription',customer_email:ctx.user.email,client_reference_id:ctx.user.id,
   line_items:[{price,quantity:1}],metadata,subscription_data:{metadata},success_url:origin+'/billing?session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/billing'});
  if(!session.livemode)throw Error();return res.json({ok:true,url:session.url});
 }catch{return res.status(503).json({ok:false,error:'checkout_unavailable'});}
}
