// /pages/api/notify-signup.js
import { sendBusiness } from '../../lib/businessTelegram.cjs';
import { verifiedSignupText } from '../../lib/signupNotification.cjs';
import { createSupabaseServiceClient } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { email, user_id } = req.body || {};
  const test = req.body?.test === true && String(email).endsWith('@example.invalid');
  try {
    let text='TEST—NO BET/NO TRADE\nWebsite signup notification routing check. No account or payment was created.';
    if(!test){
      if(!/^[a-f0-9-]{36}$/i.test(String(user_id||'')))return res.status(400).json({ok:false,error:'signup_not_verified'});
      const {data,error}=await createSupabaseServiceClient().auth.admin.getUserById(user_id);
      if(error||!data?.user)return res.status(400).json({ok:false,error:'signup_not_verified'});
      text=verifiedSignupText(data.user,{email,user_id});
    }
    const receipt = await sendBusiness(text);
    return res.status(200).json({ ok: true, ...receipt });
  } catch {
    return res.status(503).json({ok:false,error:'business_notification_unavailable'});
  }
}
