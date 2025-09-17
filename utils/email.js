// /utils/email.js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ from, to, subject, html }) {
  return resend.emails.send({ from, to, subject, html });
}
