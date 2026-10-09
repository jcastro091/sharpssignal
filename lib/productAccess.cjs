const PRODUCTS = ['sports', 'markets'];
const LABELS = {sports: 'Sports', markets: 'Markets'};
function products(value) {
  if (!Array.isArray(value) || !value.length || value.some(x=>!PRODUCTS.includes(x)) || new Set(value).size!==value.length) throw Error('invalid_products');
  return PRODUCTS.filter(x=>value.includes(x));
}
function grantProducts(grant) {
  // Existing Pro subscriptions retain Sports; preferences never grant paid access.
  if (!grant || grant.plan !== 'pro_telegram') return [];
  try { return products(grant.products ?? ['sports']); } catch { return []; }
}
function metadataProducts(metadata) {
  return metadata?.products == null ? ['sports'] : products(metadata.products.split(','));
}
function productChat(product, env=process.env) {
  if (!PRODUCTS.includes(product)) throw Error('invalid_products');
  const chat = String(product==='sports'?env.PRO_CHAT_ID:env.MARKET_SHADOW_TELEGRAM_CHAT_ID).trim();
  if (!/^-[1-9]\d+$/.test(chat) || chat===String(env.OPS_TELEGRAM_CHAT_ID) || chat===String(env.BUSINESS_TELEGRAM_CHAT_ID) || String(env.PRO_CHAT_ID)===String(env.MARKET_SHADOW_TELEGRAM_CHAT_ID)) throw Error('paid_channel_not_configured');
  return chat;
}
function chatProduct(chat, env=process.env) {
  return PRODUCTS.find(p=>{try{return productChat(p,env)===String(chat);}catch{return false;}});
}
module.exports={PRODUCTS,LABELS,products,grantProducts,metadataProducts,productChat,chatProduct};
