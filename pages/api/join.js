// /pages/api/join.js
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../../utils/email';
import { tgSendMessage } from '../../utils/tg';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE // server-side secure key
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { email, sport_interest, utm_source, utm_medium, utm_campaign, referrer } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Generate a simple referral code
  const ref_code = Math.random().toString(36).slice(2, 8).toUpperCase();

  // 1) Insert / upsert into leads
  const { error: upsertErr } = await supabase.from('leads').upsert({
    email,
    sport_interest: sport_interest || 'all',
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    referrer: referrer || null,
    ref_code
  }, { onConflict: 'email' });

  if (upsertErr) {
    console.error(upsertErr);
    return res.status(500).json({ error: 'Failed to save email' });
  }

  // 2) Send welcome email (same message you use today, links kept)
  try {
    const html = `
      <div style="font-family:sans-serif;padding:20px;">
        <h2>Welcome to SharpSignal!</h2>
        <p>You're now part of the beta. Expect picks, recaps, and real-time performance straight to your inbox or dashboard.</p>
        <p style="margin-top:20px;">🧠 Built by bettors, for bettors. Let's beat the books.</p>

        <a href="https://t.me/+I-yXomYH5oNmN2Rh"
           style="display:inline-block;margin-top:25px;padding:12px 20px;background-color:#6366f1;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
          👉 Join the Telegram Channel
        </a>

        <a href="https://www.sharps-signal.com/signup"
           style="display:inline-block;margin-top:15px;padding:12px 20px;background-color:#10b981;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
          🔐 Create Your Dashboard Login
        </a>
      </div>`;

    await sendEmail({
      from: 'SharpSignal <noreply@sharps-signal.com>',
      to: email,
      subject: '🎯 Welcome to SharpSignal',
      html
    });
  } catch (err) {
    console.error('Email error:', err);
    // continue; we can still notify you and return success
  }

  // 3) Notify founder on Telegram
  try {
    const lines = [
      '🆕 New signup',
      email,
      `Sport: ${sport_interest || 'all'}`,
      `UTM: ${utm_source || '-'}/${utm_medium || '-'}/${utm_campaign || '-'}`,
      referrer ? `Referrer: ${referrer}` : null
    ].filter(Boolean).join('\n');

    await tgSendMessage(process.env.FOUNDER_TG_CHAT_ID, lines);
  } catch (e) {
    console.error('Telegram notify error:', e);
  }

  res.status(200).json({ success: true })
}
