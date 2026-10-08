import Link from 'next/link';
export default function AccessJourney({realtime=false}){
 return <section className="access-journey" aria-label="Your access plan"><div><span className="eyebrow">{realtime?'PAID ACCESS ACTIVE':'YOUR FREE DASHBOARD'}</span><h2>{realtime?'Finish your Telegram setup.':'Research now. Telegram when you upgrade.'}</h2><p>{realtime?'Connect your account and get your personal invitation to the paid channel.':'Browse sports and market research with a minimum 30-minute delay. For real-time access, pay securely on Stripe, then link Telegram and join the private channel.'}</p></div><Link className="button-primary" href="/billing">{realtime?'Connect Telegram →':'Upgrade to real-time + Telegram →'}</Link></section>;
}
