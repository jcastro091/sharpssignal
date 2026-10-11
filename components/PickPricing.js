import Link from "next/link";

const waitlistEmail = "mailto:SharpsSignal@gmail.com?subject=Sharp%20Signals%20%245%20pick%20waitlist&body=I%20am%20interested%20in%20the%20proposed%20%245-per-pick%20service.%20Please%20email%20me%20about%20its%20availability.%20I%20understand%20this%20is%20not%20a%20purchase.";

export default function PickPricing() {
  return (
    <section className="feature-section" aria-labelledby="pick-pricing-title">
      <span className="eyebrow">INTEREST WAITLIST · NOT AVAILABLE TO BUY</span>
      <h2 id="pick-pricing-title">Interested in $5 per pick?</h2>
      <p>
        We’re exploring a service where you could buy individual sports selections.
        Join the interest waitlist to hear more as we develop it. The proposed price
        is $5 per pick; this is not a launch announcement or an offer to purchase.
      </p>
      <p>
        No payment. No commitment. No launch date promised. We’ll share the
        evidence, final pricing and any pick-fee refund terms before asking you
        to buy. Winning outcomes and wagering returns are never guaranteed.
      </p>
      <a className="button-secondary" href={waitlistEmail}>
        Email to join the waitlist
      </a>
      <p className="muted">
        Opens an email to SharpsSignal@gmail.com. Send it to register your
        interest and request availability updates. This does not create an
        account or subscribe you to our weekly newsletter.
      </p>
      <Link href="/legal#pick-refunds">Existing pick-fee refund terms</Link>
    </section>
  );
}
