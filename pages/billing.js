import {useState} from 'react';
import {useRouter} from 'next/router';
import {createPagesServerClient} from '@supabase/auth-helpers-nextjs';
import {getSafeNext} from '../lib/authRedirect';
export async function getServerSideProps(ctx){
 const client=createPagesServerClient(ctx);const {data:{user}}=await client.auth.getUser();
 if(!user?.email_confirmed_at)return {redirect:{destination:'/signin?next='+encodeURIComponent(getSafeNext(ctx.resolvedUrl||'/billing')),permanent:false}};
 return {props:{qaEnabled:process.env.QA_CHECKOUT_ENABLED==='true'&&user.id===process.env.QA_CHECKOUT_USER_ID}};
}
export default function Billing({qaEnabled}){
 const router=useRouter();const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function action(path,body={}){
  setBusy(true);setMessage('Checking…');
  try{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json();
   if(!r.ok||!data.ok)throw Error(data.error||'Please try again.');
   if(data.url)window.location.assign(data.url);
   else setMessage(data.command?'Send '+data.command+' to the SharpsSignal bot in a private chat.':data.receipt?'Test notification sent. Receipt '+data.receipt:data.paid?'Payment verified. Your temporary verification access is active.':'Done.');
  }catch(error){setMessage(error.message.replaceAll('_',' '));}finally{setBusy(false);}
 }
 return <main className="experience-shell"><section className="auth-card"><h1>Your real-time access.</h1>
  <p>Free accounts can browse paper bets and trades after a 30-minute delay. Real-time Telegram access requires verified payment.</p>
  {qaEnabled?<><h2>Owner verification</h2><p>This checkout charges $1 once. It has no renewal. The payment will be refunded after verification; temporary access lasts up to 30 minutes.</p>
   <button disabled={busy} onClick={()=>action('/api/stripe/qa-checkout')}>Open $1 verification checkout</button>
   
   <button disabled={busy} onClick={()=>action('/api/qa-alert-delivery')}>Send labelled test alert</button>
  </>:<p>Paid checkout is being prepared. Your delayed research dashboard remains available.</p>}
  {typeof router.query.session_id==='string'&&<button disabled={busy} onClick={()=>action(qaEnabled?'/api/stripe/qa-verify':'/api/stripe/verify-success',{session_id:router.query.session_id})}>Verify completed payment</button>}
  <h2>Connect Telegram</h2><p>Link your Telegram account, then request an invite. Admission requires current verified payment.</p>
  <button disabled={busy} onClick={()=>action('/api/telegram-link-code')}>Get Telegram linking command</button>
  <button disabled={busy} onClick={()=>action('/api/telegram-invite')}>Request paid Telegram invite</button>
  <p role="status">{message}</p><a href="/dashboard">Back to dashboard</a>
 </section></main>;
}
