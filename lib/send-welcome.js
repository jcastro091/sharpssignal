import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function sendWelcomeEmail(email) {
  try {
    await resend.emails.send({
      from: 'SharpSignal <welcome@sharpsignal.io>',
      to: email,
      subject: 'Welcome to SharpSignal 🎯',
      html: `<p>Thanks for signing up! Your winning picks await.</p>`,
    });
  } catch (error) {
    console.error('[Resend error]', error);
  }
}
