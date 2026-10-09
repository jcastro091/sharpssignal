import {withAuthTimeout} from './authWait';
import {createPagesServerClient} from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';
import {createSupabaseServiceClient} from './supabaseServer';
const {refreshCustomerAccess}=require('./realtimeBilling.cjs');
export async function customerFeedContext(req,res){
 const client=createPagesServerClient({req,res});const {data:{user}}=await withAuthTimeout(()=>client.auth.getUser(),8000);
 if(!user?.email_confirmed_at)return null;
 const {data:{session}}=await withAuthTimeout(()=>client.auth.getSession(),2000);
 let realtime=false;
 if(process.env.STRIPE_SECRET_KEY)try{const grant=await withAuthTimeout(()=>refreshCustomerAccess(new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2025-06-30.basil',timeout:10000,maxNetworkRetries:0}),createSupabaseServiceClient(),user.id),4000);realtime=Boolean(grant&&(!grant.qa_test||user.id===process.env.QA_CHECKOUT_USER_ID));}catch{}
 if(!session?.access_token)return null;
 return {user,token:session.access_token,realtime};
}
export async function customerFeed(ctx,section){
 const origin=process.env.MEMBER_FEED_BACKEND_URL||'https://sharpssignal-sports-backend.vercel.app';
 const response=await fetch(origin+'/api/member-feed?section='+section+(ctx.realtime?'':'&force_delayed=1'),{headers:{Authorization:'Bearer '+ctx.token},signal:AbortSignal.timeout(20000)});
 return {status:response.status,body:await response.json()};
}
