// /utils/email.js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ from, to, subject, html }) {
  const sender = process.env.RESEND_FROM || from;
  if (!sender) throw new Error('Email sender is not configured');
  const { data, error } = await resend.emails.send({
    from: sender, to, subject, html,
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
  });
  if (error) throw new Error('Email provider rejected the request');
  return data;
}
