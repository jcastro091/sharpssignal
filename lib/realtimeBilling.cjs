const {grantProducts,productChat}=require('./productAccess.cjs');
const crypto = require('node:crypto');
const idOf = value => typeof value === 'string' ? value : value?.id;
function requireTrue(value, error) { if (!value) throw new Error(error); }
function paidQAReceipt(session, userId, now = Date.now()) {
  requireTrue(session.metadata?.user_id === userId, 'checkout_owner_mismatch');
  requireTrue(session.livemode === true && session.mode === 'payment' && session.status === 'complete' &&
    session.payment_status === 'paid' && session.amount_total === 100 && session.currency === 'usd' &&
    session.metadata?.plan === 'qa_realtime' && session.metadata?.qa_test === 'true', 'payment_not_verified');
  const intent = session.payment_intent, charge = intent?.latest_charge;
  requireTrue(intent && typeof intent === 'object' && intent.status === 'succeeded' &&
    intent.livemode === true && intent.amount === 100 && intent.amount_received === 100 &&
    intent.currency === 'usd' && intent.metadata?.user_id === userId &&
    idOf(intent.customer) === idOf(session.customer), 'payment_intent_not_verified');
  requireTrue(charge && typeof charge === 'object' && charge.livemode === true && charge.paid === true &&
    charge.captured === true && charge.amount === 100 && charge.currency === 'usd' &&
    charge.amount_refunded === 0 && !charge.refunded && !charge.disputed &&
    idOf(charge.payment_intent) === intent.id && idOf(charge.customer) === idOf(session.customer), 'charge_not_verified');
  requireTrue(Number.isSafeInteger(charge.created) && charge.created > 0 && charge.created * 1000 <= now + 5000,
    'payment_time_not_verified');
  return { stripe_session_id: session.id, user_id: userId, billing_mode: 'live', plan: 'pro_telegram',
    status: 'paid', stripe_payment_intent_id: intent.id, stripe_customer_id: idOf(session.customer),
    paid_at: new Date(charge.created * 1000).toISOString(),
    valid_until: new Date(charge.created * 1000 + 30 * 60000).toISOString(),
    verified_at: new Date(now).toISOString(), qa_test: true, amount_cents: 100, currency: 'usd' };
}
async function verifiedQAGrant(stripe, supabase, sessionId, userId, now = Date.now()) {
  requireTrue(/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(sessionId), 'invalid_checkout_id');
  const session = await stripe.checkout.sessions.retrieve(sessionId, {expand: ['payment_intent.latest_charge']});
  const row = paidQAReceipt(session, userId, now);
  requireTrue(Date.parse(row.valid_until) > now, 'verification_access_expired');
  const existing = await supabase.from('customer_entitlements').select('*').eq('stripe_session_id', sessionId).maybeSingle();
  if (existing.error) throw new Error('entitlement_storage_unavailable');
  requireTrue(!existing.data || existing.data.user_id === userId, 'entitlement_owner_mismatch');
  requireTrue(!existing.data?.revoked_at, 'entitlement_revoked');
  // The database preserves the original paid time/expiry on replay.
  const applied = await supabase.rpc('apply_customer_payment', {payment: row});
  if (applied.error) throw new Error('entitlement_not_applied');
  return {...row, ...applied.data};
}
async function refreshCustomerGrants(stripe, supabase, userId, now = Date.now()) {
  const grants=[];
  const result = await supabase.from('customer_entitlements').select('*').eq('user_id', userId).eq('status','paid')
    .is('revoked_at', null);
  if (result.error) throw new Error('entitlement_storage_unavailable');
  for (const row of result.data || []) {
    if (row.qa_test) {
      if (Date.parse(row.valid_until) <= now) continue;
      try { grants.push(await verifiedQAGrant(stripe, supabase, row.stripe_session_id, userId, now)); continue; }
      catch (error) {
        // A provider outage is not evidence of cancellation. It still grants no access.
        if (['charge_not_verified','payment_not_verified','payment_intent_not_verified'].includes(error.message))
          await supabase.from('customer_entitlements').update({status:'revoked',revoked_at:new Date(now).toISOString()}).eq('stripe_session_id',row.stripe_session_id);
        throw error;
      }
    }
    try { grants.push(await verifiedSubscriptionGrant(stripe,supabase,row.stripe_session_id,userId,now)); }
    catch(error){
      if(error.message==='subscription_payment_not_verified'){
        const write=await supabase.from('customer_entitlements').update({status:'revoked',revoked_at:new Date(now).toISOString()}).eq('stripe_session_id',row.stripe_session_id);
        if(write.error)throw Error('revocation_not_applied');
        continue;
      }
      throw error;
    }
  }
  return grants;
}
async function refreshCustomerAccess(stripe,supabase,userId,now=Date.now(),product) {
 const grants=await refreshCustomerGrants(stripe,supabase,userId,now);
 return grants.find(g=>!product||grantProducts(g).includes(product))||null;
}
async function verifiedSubscriptionGrant(stripe,supabase,sessionId,userId,now=Date.now()) {
  const {inspectSubscriptionPayment}=require('./stripeSubscriptionEvidence.cjs');
  const row=await inspectSubscriptionPayment(stripe,sessionId,userId,now,{livemode:true});
  const applied=await supabase.rpc('apply_customer_payment',{payment:row});
  if(applied.error)throw Error('entitlement_not_applied');
  return applied.data;
}
async function telegram(method, body, token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN) {
  requireTrue(token, 'telegram_unavailable');
  const response = await fetch('https://api.telegram.org/bot'+token+'/'+method, {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),
  });
  const data = await response.json();
  requireTrue(response.ok && data.ok, 'telegram_request_failed');
  return data.result;
}
async function paidInvite({supabase,grant,telegramUserId,chatId,product,send=telegram,now=Date.now(),env=process.env}) {
  requireTrue(grant?.billing_mode === 'live' && grant?.status === 'paid' && !grant.revoked_at && Date.parse(grant.valid_until)>now && now-Date.parse(grant.verified_at)<60000 && Date.parse(grant.verified_at)<=now, 'payment_required');
  requireTrue(product && grantProducts(grant).includes(product) && !grant.qa_test && productChat(product,env)===String(chatId), 'product_payment_required');
  requireTrue(telegramUserId && chatId, 'telegram_link_required');
  const chat = await send('getChat',{chat_id:chatId});
  requireTrue(['channel','supergroup'].includes(chat.type) && !chat.username, 'paid_channel_must_be_private');
  const link=await send('createChatInviteLink',{chat_id:chatId,creates_join_request:true,
    expire_date:Math.floor(Math.min(now+10*60000,Date.parse(grant.valid_until))/1000),name:'Paid member '+crypto.randomBytes(6).toString('hex')});
  const record={invite_hash:crypto.createHash('sha256').update(link.invite_link).digest('hex'),
    user_id:grant.user_id,telegram_user_id:String(telegramUserId),chat_id:String(chatId),
    stripe_session_id:grant.stripe_session_id,expires_at:new Date(link.expire_date*1000).toISOString(),qa_test:grant.qa_test};
  const write=await supabase.from('customer_telegram_invites').insert(record);
  if(write.error){await send('revokeChatInviteLink',{chat_id:chatId,invite_link:link.invite_link}).catch(()=>{});throw new Error('invite_not_recorded');}
  return link.invite_link;
}
module.exports={refreshCustomerGrants,paidQAReceipt,verifiedQAGrant,verifiedSubscriptionGrant,refreshCustomerAccess,paidInvite,telegram};
