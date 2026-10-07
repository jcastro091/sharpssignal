import crypto from 'crypto';
import {getServerUser} from '../../lib/authServer';
import {createSupabaseServiceClient} from '../../lib/supabaseServer';
import {writeFunnelEvent} from '../../lib/funnelStore';
import growth from '../../lib/growthRules.cjs';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false});
  const user=await getServerUser(req,res);
  if(!user) return res.status(401).json({ok:false});
  if(!growth.signupConfirmed(user)) return res.status(200).json({ok:true,eligible:false});
  const event_id='signup_completed_'+crypto.createHash('sha256').update(user.id).digest('hex').slice(0,24);
  const metadata=user.user_metadata||{};const touch=metadata.signup_attribution||{};
  const row={event_id,event_name:'signup_completed',event_type:'signup_completed',event_at:user.email_confirmed_at,created_at:user.email_confirmed_at,source:'verified_signup',email:user.email,visitor_id:metadata.signup_visitor_id||null,session_id:metadata.signup_session_id||null,page_path:'/signup',landing_page:growth.cleanUrl(touch.first_url||''),referrer:growth.cleanUrl(touch.referrer||''),metadata:{confirmation_verified:true,tracking_version:2}};
  for(const key of growth.ATTRIBUTION_KEYS) row[key]=String(touch[key]||'').slice(0,200)||null;
  try {const result=await writeFunnelEvent(createSupabaseServiceClient(),row);if(result.error)throw result.error;
    return res.status(200).json({ok:true,eligible:true,event_id});
  }catch{return res.status(503).json({ok:false,error:'tracking_unavailable'});}
}
