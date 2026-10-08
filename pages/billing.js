import {useEffect,useState,useCallback,useRef} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import Stripe from 'stripe';
import {createPagesServerClient} from '@supabase/auth-helpers-nextjs';
import {getSafeNext} from '../lib/authRedirect';
const {checkoutOffer}=require('../lib/checkoutOffer.cjs');
export async function getServerSideProps(ctx){
 const client=createPagesServerClient(ctx);const {data:{user}}=await client.auth.getUser();
 if(!user?.email_confirmed_at)return {redirect:{destination:'/signin?next='+encodeURIComponent(getSafeNext(ctx.resolvedUrl||'/billing')),permanent:false}};
 let offer=null;
 if(process.env.PAID_CHECKOUT_ENABLED==='true'&&process.env.STRIPE_SECRET_KEY){
  try{offer=await checkoutOffer(new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2025-06-30.basil',timeout:10000,maxNetworkRetries:0}));}catch{}
 }
 return {props:{offer,qaEnabled:process.env.QA_CHECKOUT_ENABLED==='true'&&user.id===process.env.QA_CHECKOUT_USER_ID}};
}
const errors={
 payment_not_verified:'We could not confirm this payment. If you completed checkout, wait a moment and try again. Do not pay again.',
 payment_verification_unavailable:'Payment verification is temporarily unavailable. Your free dashboard is still available. Please retry.',
 checkout_unavailable:'Stripe checkout is temporarily unavailable. Please try again shortly.',
 paid_checkout_not_enabled:'Paid checkout is not currently open. You can keep using your free dashboard.',
 already_paid:'You already have paid access. Refresh your status below to connect Telegram.',
 telegram_link_required:'Send your linking command to the bot, then check the connection here.',
 telegram_invite_unavailable:'We could not create your channel invitation. Please retry; you do not need to pay again.',
 payment_required:'A verified payment is required before joining the paid channel.',
 verification_notifications_only:'Owner verification access does not include paid-channel membership.',
};
async function request(path,body){
 const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(25000)});
 const data=await r.json();if(!r.ok||!data.ok)throw Error(errors[data.error]||'We could not complete that step. Please try again.');return data;
}
function priceLabel(offer){
 if(!offer)return null;
 const price=new Intl.NumberFormat('en-US',{style:'currency',currency:offer.currency}).format(offer.amount/100);
 return `${price} / ${offer.interval_count===1?offer.interval:offer.interval_count+' '+offer.interval+'s'}`;
}
export default function Billing({offer,qaEnabled}){
 const router=useRouter(),verified=useRef('');
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[command,setCommand]=useState(''),[invite,setInvite]=useState('');
 const refresh=useCallback(async()=>{const data=await request('/api/billing-status');setStatus(data);return data;},[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[refresh]);
 const session=typeof router.query.session_id==='string'?router.query.session_id:'';
 const verify=useCallback(async()=>{
  setBusy('verify');setError('');setMessage('Confirming your payment with Stripe…');
  try{await request(qaEnabled?'/api/stripe/qa-verify':'/api/stripe/verify-success',{session_id:session});await refresh();setMessage('Payment confirmed. Continue below to connect Telegram.');}
  catch(e){setError(e.message);setMessage('');}finally{setBusy('');}
 },[session,qaEnabled,refresh]);
 useEffect(()=>{if(session&&verified.current!==session){verified.current=session;verify();}},[session,verify]);
 async function action(name,fn){setBusy(name);setError('');setMessage('');try{await fn();}catch(e){setError(e.message);}finally{setBusy('');}}
 const paid=status?.paid===true,linked=status?.telegram_linked===true;
 return <main className="billing-shell">
  <Link className="record-link" href="/dashboard">← Back to your dashboard</Link>
  <header className="billing-heading"><span className="eyebrow">YOUR NEXT STEP</span><h1>{paid?'Connect your Telegram alerts.':'From free research to real-time access.'}</h1><p>Your free dashboard is ready now. Upgrade through Stripe, then connect Telegram to receive eligible alerts in the private channel. Research only; alert frequency varies and returns are not guaranteed.</p></header>
  <ol className="journey-steps" aria-label="Your access steps">
   <li data-complete="true"><span>1</span><div><b>Free dashboard</b><small>Account confirmed · 30-minute minimum delay</small></div></li>
   <li data-complete={paid} aria-current={!paid?'step':undefined}><span>2</span><div><b>Pay on Stripe</b><small>{paid?'Payment verified':'Secure checkout · review before paying'}</small></div></li>
   <li aria-current={paid?'step':undefined}><span>3</span><div><b>Connect Telegram</b><small>{linked?'Account linked · join the channel':'Link your account, then join'}</small></div></li>
  </ol>
  {error&&<div className="error-message" role="alert">{error} <button className="record-link" disabled={Boolean(busy)} onClick={()=>action('refresh',async()=>{await refresh();setMessage('Access status refreshed.');})}>Refresh access status</button></div>}
  {message&&<p className="success-message" role="status">{message}</p>}
  {router.query.checkout==='cancelled'&&!paid&&<p className="billing-notice" role="status">Checkout was cancelled. Your free dashboard is still available. You can return to Stripe whenever you’re ready.</p>}
  <div className="billing-grid">
   <section className="billing-card"><span className="status-pill">Included with your account</span><h2>Keep exploring for free.</h2><p className="billing-price">$0 <small>no card required</small></p><ul><li>Sports and market paper research</li><li>New records and updates after at least 30 minutes</li><li>Captured prices, results and research context</li></ul><Link className="button-secondary" href="/dashboard">Open free dashboard</Link></section>
   <section id="paid-plan" className="billing-card billing-paid"><span className="status-pill">{paid?'Payment verified':'Optional upgrade'}</span><h2>Real-time + Telegram</h2>{offer&&<p className="billing-price">{priceLabel(offer)}</p>}<ul><li>Real-time access to available paper research</li><li>Eligible alerts in the private Telegram channel</li><li>One account for your dashboard and Telegram access</li></ul>
    {paid?<p className="success-message">Your paid access is active. Continue to step 3 below.</p>:offer?<><p className="small muted">Recurring subscription. Renews every {offer.interval_count===1?offer.interval:offer.interval_count+' '+offer.interval+'s'} until cancelled. Stripe shows the final total before you pay.</p><button className="button-primary full-width" disabled={Boolean(busy)||!status||Boolean(session)} onClick={()=>action('checkout',async()=>{const d=await request('/api/stripe/create-checkout-session',{});window.location.assign(d.url);})}>{busy==='checkout'?'Opening Stripe…':!status?'Checking your access…':'Continue to secure Stripe checkout →'}</button></>:<p className="billing-notice">Checkout is temporarily unavailable. Your free dashboard remains available; please check back shortly.</p>}
    {session&&!paid&&<button className="button-secondary full-width" disabled={Boolean(busy)} onClick={verify}>{busy==='verify'?'Confirming payment…':'Check my completed payment'}</button>}
   </section>
  </div>
  <section className="billing-card telegram-step" aria-labelledby="telegram-title"><span className="eyebrow">STEP 3 · AFTER PAYMENT</span><h2 id="telegram-title">Connect Telegram and join your channel.</h2>
   {!paid?<p className="muted">Complete Stripe checkout first. Once your payment is verified, this section will unlock your personal Telegram setup and channel invitation.</p>:<>
    {!linked?<><p>Link the Telegram account you’ll use to join. This keeps your paid invitation tied to you.</p><button className="button-primary" disabled={Boolean(busy)} onClick={()=>action('link',async()=>{const d=await request('/api/telegram-link-code',{});setCommand(d.command);})}>{busy==='link'?'Preparing your command…':command?'Generate a fresh linking command':'1. Get my Telegram linking command'}</button>
     {command&&<div className="telegram-command"><p>Copy this command and send it in a private message to <b>@SportsBettingDataBot</b>. The command expires in 15 minutes.</p><code>{command}</code><div className="billing-actions"><button className="button-secondary" onClick={()=>action('copy',async()=>{await navigator.clipboard.writeText(command);setMessage('Command copied. Send it to the Telegram bot.');})}>Copy command</button><a className="button-primary" href="https://t.me/SportsBettingDataBot" target="_blank" rel="noopener noreferrer">2. Open Telegram bot ↗</a></div><button className="button-secondary" disabled={Boolean(busy)} onClick={()=>action('check',async()=>{const s=await refresh();setMessage(s.telegram_linked?'Telegram linked. Your channel invitation is ready below.':'Not linked yet. Send the command to the bot, then check again.');})}>3. I sent it — check connection</button></div>}
    </>:<><p className="success-message">Your Telegram account is linked.</p><p>Use that same account to request entry. The bot checks your current paid access before admitting you.</p><button className="button-primary" disabled={Boolean(busy)} onClick={()=>action('invite',async()=>{const d=await request('/api/telegram-invite',{});setInvite(d.url);})}>{busy==='invite'?'Creating invitation…':invite?'Refresh my invitation':'Get my private channel invitation'}</button>{invite&&<div className="billing-notice"><a className="button-primary" href={invite} target="_blank" rel="noopener noreferrer">Join the paid Telegram channel ↗</a><p className="small">This personal invitation expires in up to 10 minutes. Request to join in Telegram; admission is verified automatically.</p></div>}</>}
   </>}
  </section>
  <p className="small muted">Billing help or cancellation requests: <a className="record-link" href="mailto:SharpsSignal@gmail.com">SharpsSignal@gmail.com</a>.</p>
  {qaEnabled&&<details className="research-guide"><summary>Owner verification tools</summary><p>Labelled $1 verification only. No renewal and no paid-channel admission.</p><button className="button-secondary" disabled={Boolean(busy)} onClick={()=>action('qa',async()=>{const d=await request('/api/stripe/qa-checkout',{});window.location.assign(d.url);})}>Open $1 verification checkout</button></details>}
 </main>;
}
