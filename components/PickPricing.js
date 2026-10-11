import Link from "next/link";

export default function PickPricing() {
  return (
    <section className="feature-section" aria-labelledby="pick-pricing-title">
      <span className="eyebrow">PLANNED PER-PICK LAUNCH</span>
      <h2 id="pick-pricing-title">$5 per pick. Pick fee back if it loses.</h2>
      <p>
        Buy one selection with a one-time payment. No recurring charge for a
        per-pick purchase. If an eligible pick settles as a verified loss, we
        refund 100% of the price you paid for that pick to your original payment
        method. The guarantee covers the pick fee; it does not reimburse your
        sportsbook stake or wagering losses.
      </p>
      <p>
        Per-pick checkout is not open yet. $5 is our planned launch price.
        Existing subscriptions have separate billing terms.
      </p>
      <Link className="button-secondary" href="/legal#pick-refunds">
        Read the pick-fee refund policy
      </Link>
    </section>
  );
}
