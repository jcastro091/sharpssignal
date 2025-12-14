import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    const data = await resend.emails.send({
      from: 'noreply@sharps-signal.com', // domain must match Resend verified domain
      to: 'JCastro091@gmail.com',
      subject: '🔔 Test Email from SharpSignal',
      html: `<strong>Success! Your local setup is working.</strong>`,
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error });
  }
}
