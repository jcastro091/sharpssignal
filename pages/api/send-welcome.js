// /pages/api/send-welcome.js
import { sendEmail } from '../../utils/email';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const freeTelegramInvite = process.env.FREE_CHANNEL_INVITE || 'https://www.sharps-signal.com/signup';

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 40px; color: #111827; }
        .container { max-width: 600px; margin: auto; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        h1 { color: #4f46e5; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
        p { line-height: 1.6; }
        .footer { font-size: 12px; color: #6b7280; margin-top: 32px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to SharpSignal 👋</h1>
        <p>You're officially on the list for:</p>
        <ul>
          <li>✅ AI-powered betting picks</li>
          <li>✅ Weekly performance recaps</li>
          <li>✅ Real-time performance dashboards</li>
        </ul>
        <p>We combine real data with AI to deliver smarter, sharper picks — not just hype.</p>
        <a href="${freeTelegramInvite}" class="button">👉 Join Free Telegram</a>
        <a href="https://www.sharps-signal.com/signup" class="button" style="background:#10b981;margin-left:8px;">🔐 Create Dashboard Login</a>
        <div class="footer">
          You can unsubscribe at any time — but we hope you stick around.<br>
          Sent by SharpSignal · sharps-signal.com
        </div>
      </div>
    </body>
  </html>`;
  try {
    await sendEmail({
      from: 'SharpSignal <noreply@sharps-signal.com>',
      to: email,
      subject: 'Welcome to SharpSignal 🔥',
      html,
    });
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send welcome' })
  }
}
