import { Resend } from 'resend';
import { getCeoAccess } from '../../lib/ceoAccess';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if(req.method!=="POST") return res.status(405).json({ok:false});
  const access=await getCeoAccess(req,res);
  if(!access.allowed) return res.status(403).json({ok:false});
  if(req.headers.origin!==`https://${req.headers.host}`) return res.status(403).json({ok:false});
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
