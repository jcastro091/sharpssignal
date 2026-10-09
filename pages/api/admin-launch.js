import crypto from 'crypto';
import {createPagesServerClient} from '@supabase/auth-helpers-nextjs';
import {getCeoAccess} from '../../lib/ceoAccess';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 if(req.method!=='GET')return res.status(405).end();
 if(req.query.logout==='1'){const client=createPagesServerClient({req,res});await client.auth.signOut({scope:'local'});return res.redirect(303,'/signin');}
 const access=await getCeoAccess(req,res);if(!access.allowed)return res.redirect(303,'/signin?next=%2Fadmin');
 const client=createPagesServerClient({req,res});const {data:{session}}=await client.auth.getSession();if(!session)return res.status(401).end();
 const target=['audience','sports','markets'].includes(req.query.target)?req.query.target:'overview';
 const nonce=crypto.randomBytes(16).toString('base64');const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'nonce-"+nonce+"'; form-action https://sharpssignal-sports-backend.vercel.app; frame-ancestors 'none'; base-uri 'none'");
 res.setHeader('Content-Type','text/html; charset=utf-8');
 return res.status(200).send('<!doctype html><html><head><title>Opening admin dashboard</title></head><body><p>Opening your private dashboard…</p><form method="post" action="https://sharpssignal-sports-backend.vercel.app/api/admin-session"><input type="hidden" name="access_token" value="'+escape(session.access_token)+'"><input type="hidden" name="target" value="'+target+'"><button>Continue</button></form><script nonce="'+nonce+'">document.forms[0].submit()</script></body></html>');
}
