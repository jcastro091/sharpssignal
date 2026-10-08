function checkoutOrigin(env=process.env) {
 const origin=String(env.CHECKOUT_ORIGIN||env.NEXT_PUBLIC_BASE_URL||'').replace(/\/$/,'');
 if(!/^https:\/\/[a-z0-9.-]+$/.test(origin))throw Error('checkout_not_configured');
 return origin;
}
async function checkoutOffer(stripe,env=process.env) {
 if(!env.STRIPE_PRICE_PRO_TELEGRAM)throw Error('checkout_not_configured');
 const price=await stripe.prices.retrieve(env.STRIPE_PRICE_PRO_TELEGRAM,{expand:['product']});
 if(!price.active||!price.livemode||!price.product?.active||price.type!=='recurring'||price.recurring?.usage_type!=='licensed'||!Number.isSafeInteger(price.unit_amount)||price.unit_amount<=0)throw Error('checkout_not_configured');
 checkoutOrigin(env);
 return {price_id:price.id,amount:price.unit_amount,currency:price.currency,interval:price.recurring.interval,interval_count:price.recurring.interval_count};
}
module.exports={checkoutOrigin,checkoutOffer};
