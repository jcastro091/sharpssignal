// /pages/api/notify-signup.js
import { tgSendMessage } from '../../utils/tg';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { email, utm_source, utm_medium, utm_campaign } = req.body || {};
  const text = `🆕 New signup\n${email}\nUTM: ${utm_source||'-'}/${utm_medium||'-'}/${utm_campaign||'-'}`;
  await tgSendMessage(process.env.FOUNDER_TG_CHAT_ID, text);

  res.status(200).json({ ok: true });
}
