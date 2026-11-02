import Link from 'next/link';

export default function AccessJourney({realtime=false, section='sports', compact=false}) {
  const product = section === 'markets' ? 'Markets' : 'Sports';
  return <section className={`access-journey${compact ? ' access-journey-compact' : ''}`} aria-label={realtime ? 'Your paid access' : `${product} access options`}>
    <div>
      <span className="eyebrow">{realtime ? 'PAID ACCESS ACTIVE' : 'FREE ACCESS · DELAYED FEED'}</span>
      <h2>{realtime ? 'Your access and Telegram setup' : compact ? 'Want updates without the free-feed delay?' : 'Free is delayed. Paid is real-time.'}</h2>
      <p>{realtime ? `Manage your access and connect your ${product} Telegram channel in Billing.` : `Your free ${product} feed releases records and updates after at least 30 minutes. Paid ${product} access removes that delay and includes the ${product} Telegram channel.`}</p>
      {!realtime && <p className="access-journey-note">Review current pricing and renewal terms in Billing. You can keep using free access. Alert frequency varies.</p>}
    </div>
    <Link className="button-primary" href="/billing">{realtime ? 'Billing & Telegram setup →' : `See ${product} plans in Billing →`}</Link>
  </section>;
}
