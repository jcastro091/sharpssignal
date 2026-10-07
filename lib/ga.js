import growth from './growthRules.cjs';
const GA_ID=process.env.NEXT_PUBLIC_GA4_ID||process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||'G-1YRZ2NHRZ0';
export function gaEvent({ action, category, label, value, parameters = {} }) {
  if (typeof window === 'undefined' || growth.internalPath(window.location.pathname)) return false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  if(!window.__ssGaConfigured) {
    window.gtag('js',new Date());
    window.gtag('config',GA_ID,{send_page_view:false,debug_mode:false,page_location:growth.cleanUrl(window.location.href),page_referrer:growth.cleanUrl(document.referrer)});
    window.__ssGaConfigured=true;
  }
  const safe = {event_category:category,event_label:label,value,page_location:growth.cleanUrl(window.location.href),page_referrer:growth.cleanUrl(document.referrer)};
  for(const key of ['method','transaction_id','currency','value','plan','location','utm_source','utm_medium','utm_campaign','utm_content','event_id']) {
    if(parameters[key]!==undefined) safe[key]=parameters[key];
  }
  window.gtag('event',action,safe);
  return true;
}
