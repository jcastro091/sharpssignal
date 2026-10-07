import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { trackFunnelEvent } from '../lib/funnelClient';
import { gaEvent } from '../lib/ga';
import growth from '../lib/growthRules.cjs';

let lastRoute = '';
let completionRequest = null;
const sentEvents = new Set();
function emitOnce(key,event) {
  if(sentEvents.has(key)) return;
  let stored=false;try {stored=!!localStorage.getItem(key);}catch {}
  if(stored) {sentEvents.add(key);return;}
  if(!gaEvent(event)) return;
  sentEvents.add(key);try {localStorage.setItem(key,'sent');}catch {}
}
async function confirmSignup() {
  if(completionRequest) return completionRequest;
  completionRequest=(async()=>{
    try {
      const response=await fetch('/api/signup-completion',{method:'POST'});
      const data=await response.json();
      if(response.ok && data.eligible && data.event_id) {
        emitOnce('ss_ga_'+data.event_id,{action:'sign_up',category:'funnel',parameters:{method:'email',event_id:data.event_id}});
      }
    } catch {} finally {completionRequest=null;}
  })();
  return completionRequest;
}
export default function FunnelTracker() {
  const router=useRouter();
  useEffect(()=>{
    if(!router.isReady) return;
    function track(url) {
      const path=String(url||window.location.pathname).split(/[?#]/)[0];
      const route=path+window.location.search;
      if(growth.internalPath(path) || route===lastRoute) return;
      lastRoute=route;
      const event=growth.eventForPath(path);
      if(event) gaEvent({action:'page_view',category:'navigation'});
      if(event) void trackFunnelEvent(event,{path});
      else void trackFunnelEvent('page_view',{path});
      void supabase.auth.getSession().then(({data})=>{if(data?.session)void confirmSignup();}).catch(()=>{});
      const query=new URLSearchParams(window.location.search);
      if(query.get('checkout')==='cancelled') void trackFunnelEvent('checkout_abandoned',{location:'checkout_return'});
      const id=query.get('session_id');
      if(query.get('checkout')==='success' && /^cs_/.test(id||'')) {
        fetch('/api/stripe/verify-success?session_id='+encodeURIComponent(id),{cache:'no-store'}).then(r=>r.json()).then(d=>{
          if(!d.ok || !d.purchase) return;
          emitOnce('ss_purchase_'+d.purchase.transaction_id,{action:'purchase',category:'funnel',parameters:d.purchase});
        }).catch(()=>{});
      }
    }
    track(router.asPath);
    router.events.on('routeChangeComplete',track);
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(session && ['INITIAL_SESSION','SIGNED_IN'].includes(event)) setTimeout(()=>void confirmSignup(),0);
    });
    return ()=>{router.events.off('routeChangeComplete',track);subscription.unsubscribe();};
  },[router.isReady,router.events]);
  return null;
}
