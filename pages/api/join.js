import { supabase } from '../../lib/supabaseClient';
import sendWelcomeEmail from '../../lib/send-welcome';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const { error } = await supabase
    .from('email_signups') // ✅ FIXED
    .insert([{ email }]);

  if (error) {
    console.error('[Supabase error]', error);
    return res.status(500).json({ error: 'Failed to save email' });
  }

  try {
    await sendWelcomeEmail(email);
  } catch (e) {
    console.warn('Email saved, but welcome email failed', e.message);
  }

  return res.status(200).json({ message: 'Email saved and welcome sent' });
}
