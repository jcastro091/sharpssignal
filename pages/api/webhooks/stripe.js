import crypto from "crypto";
import { buffer } from "micro";
import Stripe from "stripe";
import { createSupabaseServiceClient } from "../../../lib/supabaseServer";
import { createStripeWebhook } from "../../../lib/stripeWebhook";
export const config = { api: { bodyParser: false } };

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function getStore() {
  const db = createSupabaseServiceClient();
  async function one(table, column, value) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return {
    event: (id) => one("stripe_webhook_events", "event_id", id),
    subscription: (id) => one("subscriptions", "stripe_subscription_id", id),
    async user(id) {
      const { data, error } = await db.auth.admin.getUserById(id);
      if (error) throw error;
      return data?.user;
    },
    async apply(payload) {
      const { data, error } = await db.rpc("apply_verified_stripe_event", {
        payload,
      });
      if (error) throw error;
      return data;
    },
  };
}
const verifiedWebhook=createStripeWebhook({
  readBody: req=>req.verifiedRawBody||buffer(req),
  getStripe: () =>
    process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY, {
          timeout: 10000,
          maxNetworkRetries: 0,
        })
      : null,
  getSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
  getStore,
  hashEvent: (event) =>
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify(
          canonical({
            id: event.id,
            type: event.type,
            created: event.created,
            account: event.account || null,
            livemode: event.livemode,
            object: event.data?.object,
          }),
        ),
      )
      .digest("hex"),
});

export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false});
 if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).json({ok:false});
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2025-06-30.basil',timeout:10000,maxNetworkRetries:0});
 let event;
 try{req.verifiedRawBody=await buffer(req);event=stripe.webhooks.constructEvent(req.verifiedRawBody,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}catch{return res.status(400).json({ok:false,error:'invalid_signature'});}
 const object=event.data?.object;
 if(object?.metadata?.qa_test==='true'){
  if(object.metadata.user_id!==process.env.QA_CHECKOUT_USER_ID)return res.status(403).json({ok:false});
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   try{const {verifiedQAGrant}=require('../../../lib/realtimeBilling.cjs');await verifiedQAGrant(stripe,createSupabaseServiceClient(),object.id,object.metadata.user_id);}
   catch{return res.status(503).json({ok:false,error:'qa_payment_not_verified'});}
  }
  return res.json({ok:true,qa_test:true});
 }
 // Initial grants are verified before acknowledging the checkout event.
 if(event.type==='checkout.session.completed'&&object?.metadata?.plan==='pro_telegram'){
  try{
   const {verifiedSubscriptionGrant}=require('../../../lib/realtimeBilling.cjs');
   await verifiedSubscriptionGrant(stripe,createSupabaseServiceClient(),object.id,object.metadata.user_id);
  }catch{return res.status(503).json({ok:false,error:'subscription_payment_not_verified'});}
 }
 // Refunds/cancellations are checked freshly before every access/admission.
 return verifiedWebhook(req,res);
}
