// /pages/api/notify-signup.js
import { sendBusiness } from '../../lib/businessTelegram.cjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { email, utm_source, utm_medium, utm_campaign } = req.body || {};
  const test = req.body?.test === true && String(email).endsWith('@example.invalid');
  const text = test ? 'TEST—NO BET/NO TRADE\nWebsite signup notification routing check. No account or payment was created.' : `🆕 New signup\n${email}\nUTM: ${utm_source||'-'}/${utm_medium||'-'}/${utm_campaign||'-'}`;
  try {
    const receipt = await sendBusiness(text);
    return res.status(200).json({ ok: true, ...receipt });
  } catch {
    return res.status(503).json({ok:false,error:'business_notification_unavailable'});
  }
}
