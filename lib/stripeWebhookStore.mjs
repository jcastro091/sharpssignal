export function createStripeWebhookStore(db) {
  async function one(table,column,value) {
    const {data,error}=await db.from(table).select('*').eq(column,value).maybeSingle();
    if(error)throw error;
    return data;
  }
  return {
    async event(id) {
      return await one('stripe_webhook_events','event_id',id) || await one('stripe_webhook_review','event_id',id);
    },
    async subscription(id) {
      const existing=await one('subscriptions','stripe_subscription_id',id);
      if(existing)return existing;
      // Reuse an account binding already verified at checkout. Never map by email.
      const {data,error}=await db.from('customer_entitlements').select('*')
        .eq('stripe_subscription_id',id).eq('billing_mode','live').eq('qa_test',false).maybeSingle();
      if(error)throw error;
      if(!data)return null;
      if(!data.user_id||!data.stripe_customer_id||!data.stripe_session_id||data.plan!=='pro_telegram')throw Error('invalid_verified_binding');
      return {user_id:data.user_id,stripe_customer_id:data.stripe_customer_id,
        stripe_subscription_id:id,stripe_checkout_session_id:data.stripe_session_id,plan:data.plan};
    },
    async user(id) {
      const {data,error}=await db.auth.admin.getUserById(id);
      if(error)throw error;
      return data?.user;
    },
    async recordUnmapped(payload) {
      const saved=await db.from('stripe_webhook_review').upsert(payload,{onConflict:'event_id',ignoreDuplicates:true});
      if(saved.error)throw saved.error;
      const proof=await one('stripe_webhook_review','event_id',payload.event_id);
      if(!proof||['payload_hash','stripe_subscription_id','stripe_customer_id','reason'].some(key=>proof[key]!==payload[key]))throw Error('review_receipt_conflict');
    },
    async apply(payload) {
      const {data,error}=await db.rpc('apply_verified_stripe_event',{payload});
      if(error)throw error;
      return data;
    },
  };
}
