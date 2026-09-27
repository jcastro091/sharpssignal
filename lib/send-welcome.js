import { sendEmail } from '../utils/email';

export default async function sendWelcomeEmail(email) {
  try {
    await sendEmail({
      to: email,
      subject: 'Welcome to SharpsSignal',
      html: `<p>Thanks for joining SharpsSignal. Your dashboard shows recorded paper research and results. Returns are not guaranteed.</p>`,
    });
  } catch (error) {
    console.error('[Resend error]', error);
  }
}
