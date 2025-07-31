import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function sendWelcomeEmail(email) {
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
          <li>✅ Exclusive insights from the team</li>
        </ul>
        <p>At SharpSignal, we combine real data with AI to deliver smarter, sharper picks — not just hype. You're joining a community that values transparency, data-backed confidence, and long-term edge.</p>
        <p>We’re not just building a newsletter — we’re building a movement. And you’re part of it 💡</p>
        <p>No spam. No pressure. Just signals that matter.</p>
        <a href="https://sharpsignal.ai" class="button">View Latest Picks</a>
        <div class="footer">
          You can unsubscribe at any time — but we hope you stick around.<br>
          Sent by SharpSignal · AI. Confidence. Clarity.
        </div>
      </div>
    </body>
  </html>
  `;


  return await resend.emails.send({
    from: 'SharpSignal <welcome@sharpsignal.ai>',
    to: email,
    subject: 'Welcome to SharpSignal 🔥',
    html,
  });
}
