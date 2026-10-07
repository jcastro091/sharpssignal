const ATTRIBUTION_KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','referral_code'];
function internalPath(path) { return /^\/(admin|api|auth|ceo-dashboard)(\/|$)/.test(path); }
function eventForPath(path) {
  if (path === '/') return 'landing_view';
  if (path === '/signup') return 'signup_view';
  if (path === '/subscribe') return 'subscribe_view';
  if (path === '/picks-preview') return 'picks_preview_view';
  if (['/dashboard','/picks','/sports'].includes(path)) return 'dashboard_view';
  return '';
}
function cleanUrl(value, origin='https://www.sharps-signal.com') {
  if(!value) return '';
  try { const u=new URL(value,origin); if(!['https:','http:'].includes(u.protocol)) return ''; const p=new URLSearchParams();
    for(const k of ATTRIBUTION_KEYS) if(u.searchParams.get(k)) p.set(k,u.searchParams.get(k).slice(0,200));
    return u.origin+u.pathname+(p.size?'?'+p:'');
  } catch { return ''; }
}
function inferSource(value, origin='https://www.sharps-signal.com') {
  try { const host=new URL(value).hostname.toLowerCase().replace(/^www\./,''); const own=new URL(origin).hostname.replace(/^www\./,'');
    if(host===own || host==='sharps-signal.com' || host==='sharpssignal-sports-backend.vercel.app') return {utm_source:'direct',utm_medium:'none'};
    if(['x.com','twitter.com','t.co'].includes(host)) return {utm_source:'x',utm_medium:'social'};
    if(['instagram.com','l.instagram.com'].includes(host)) return {utm_source:'instagram',utm_medium:'social'};
    if(['tiktok.com','vm.tiktok.com'].includes(host)) return {utm_source:'tiktok',utm_medium:'social'};
    if(/(^|\.)(google\.[a-z.]+|bing.com|duckduckgo.com)$/.test(host)) return {utm_source:host.includes('google.')?'google':host.includes('bing.')?'bing':'duckduckgo',utm_medium:'organic'};
    return {utm_source:host,utm_medium:'referral'};
  } catch { return {utm_source:'direct',utm_medium:'none'}; }
}
function attributed(t) { return !!t && (!!t.utm_campaign || !!t.referral_code || (!!t.utm_source && t.utm_source!=='direct')); }
function mergeTouch(existing,current) {
  if(!existing || (!attributed(existing)&&attributed(current))) return {...current};
  return {...existing}; // Keep one coherent acquisition; never mix unrelated campaigns.
}
function signupConfirmed(user) { return !!(user?.id && user.email_confirmed_at && user.user_metadata?.signup_tracking_version===2); }
function paidCheckout(session) { return session?.status==='complete' && session?.payment_status==='paid'; }
function purchaseParameters(session) { return {transaction_id:session.id,value:(session.amount_total||0)/100,currency:String(session.currency||'usd').toUpperCase()}; }
module.exports={ATTRIBUTION_KEYS,internalPath,eventForPath,cleanUrl,inferSource,mergeTouch,signupConfirmed,paidCheckout,purchaseParameters};
