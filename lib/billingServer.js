import Stripe from 'stripe';
import {getServerUser} from './authServer';
import {createSupabaseServiceClient} from './supabaseServer';
const billing=require('./realtimeBilling.cjs');
export async function billingUser(req,res){
 const user=await getServerUser(req,res);
 if(!user?.email_confirmed_at){res.status(401).json({ok:false,error:'confirmed_account_required'});return null;}
 if(!process.env.STRIPE_SECRET_KEY){res.status(503).json({ok:false,error:'billing_unavailable'});return null;}
 return {user,stripe:new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2025-06-30.basil',timeout:12000,maxNetworkRetries:0}),supabase:createSupabaseServiceClient()};
}
export async function realtimeUser(req,res){
 const ctx=await billingUser(req,res);if(!ctx)return null;
 try{ctx.grant=await billing.refreshCustomerAccess(ctx.stripe,ctx.supabase,ctx.user.id);}
 catch{res.status(503).json({ok:false,error:'payment_verification_unavailable'});return null;}
 if(!ctx.grant){res.status(402).json({ok:false,error:'payment_required'});return null;}
 return ctx;
}
