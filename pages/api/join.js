// /pages/api/join.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // 1. Save email to Supabase
  const { data, error } = await supabase.from('email_signups').insert([{ email }]);

  if (error) return res.status(500).json({ error: 'Failed to save email' });

  // 2. Send welcome email via Resend
  try {
    await resend.emails.send({
      from: 'SharpSignal <noreply@sharps-signal.com>',
      to: email,
      subject: '🎯 Welcome to SharpSignal',
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2>Welcome to SharpSignal!</h2>
          <p>You're now part of the beta. Expect picks, recaps, and real-time performance straight to your inbox or dashboard.</p>
          <p style="margin-top:20px;">🧠 Built by bettors, for bettors. Let's beat the books.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: 'Signup saved but failed to send welcome email.' });
  }

  res.status(200).json({ success: true });
}
