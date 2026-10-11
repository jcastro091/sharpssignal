export default function LegalPage() {
  return (
    <main className="bg-white text-slate-950">
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-bold">SharpSignal Legal</h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: October 11, 2026
        </p>

        <div className="mt-10 space-y-10 leading-7 text-slate-700">
          <section id="terms">
            <h2 className="text-2xl font-semibold text-slate-950">
              Terms of Service
            </h2>
            <p className="mt-4">
              SharpSignal provides sports betting information, model-generated
              picks, dashboard analytics, and optional Telegram alerts. We do
              not place bets, execute transactions, or manage bankrolls for
              users.
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li>
                <strong>Performance:</strong> Past performance does not
                guarantee future results.
              </li>
              <li>
                <strong>User responsibility:</strong> You are responsible for
                any wagering or financial decision you make.
              </li>
              <li>
                <strong>Subscriptions:</strong> Stripe manages paid
                subscriptions. You may cancel according to Stripe checkout
                terms.
              </li>
              <li>
                <strong>Access:</strong> Telegram access is provided after
                payment verification and may be revoked for abuse or
                redistribution.
              </li>
              <li>
                <strong>Acceptable use:</strong> Do not resell, scrape, or
                automate redistribution of SharpSignal alerts without written
                permission.
              </li>
            </ul>
          </section>

          <section id="pick-refunds">
            <h2 className="text-2xl font-semibold text-slate-950">Per-pick pricing and pick-fee refund policy</h2>
            <p className="mt-4"><strong>Launch status:</strong> Per-pick checkout is not open yet. Our planned launch price is $5 per pick, paid once with no recurring charge. The price and refund eligibility will be shown before payment. Existing subscription purchases remain subject to their own billing terms.</p>
            <p className="mt-4"><strong>100% pick-fee refund:</strong> When a purchased pick explicitly includes this guarantee and its published selection settles as an independently verified final loss, we refund the full amount actually paid for that pick, including any sales tax charged for it. A discounted purchase receives the discounted amount paid. The guarantee covers the pick purchase price, not a sportsbook stake, wagering loss, or expected profit. You do not need to place a wager to qualify.</p>
            <p className="mt-4"><strong>Settlement:</strong> We use the selection and market attached to the purchase and the verified final result. A winning pick does not qualify. Open games, unverified results, pushes, cancellations and voids are not automatically eligible under the losing-pick guarantee; contact support for review of cancelled or void selections and any billing issue.</p>
            <p className="mt-4"><strong>How to request a refund:</strong> Email <a href="mailto:SharpsSignal@gmail.com" className="underline">SharpsSignal@gmail.com</a> with your order or Stripe receipt reference and the pick. Do not send card details. A verified final loss queues eligible orders for an automatic refund to their original payment methods; you do not need to request the standard losing-pick refund. Contact support if the outcome or refund needs review. The admin workspace tracks queued, pending, completed and failed refunds. A pending provider refund is not a completed refund.</p>
            <p className="mt-4"><strong>Refund method and timing:</strong> Refunds go to the original payment method. We do not deduct our payment-processing costs from your qualifying refund. After a refund is issued, bank processing typically takes 5–10 business days and may vary. If part of the pick fee has already been refunded, we refund only the remaining balance; total refunds cannot exceed the amount paid. Payments under an active dispute require resolution with the payment provider before a separate refund can be issued.</p>
            <p className="mt-4">This guarantee applies only to qualifying per-pick purchases that disclose it at checkout. It does not apply retroactively to subscriptions, free picks or test purchases. It does not limit any statutory consumer rights.</p>
          </section>

          <section id="privacy">
            <h2 className="text-2xl font-semibold text-slate-950">
              Privacy Policy
            </h2>
            <p>
              <a href="/privacy">
                Read our updated privacy notice and optional analytics choices.
              </a>
            </p>
            <p className="mt-4">
              We collect the minimum data needed to authenticate users, provide
              alerts, manage billing, measure product performance, and respond
              to support requests.
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li>
                <strong>Data collected:</strong> Email, login metadata,
                subscription metadata, Telegram access events, and dashboard
                analytics.
              </li>
              <li>
                <strong>Vendors:</strong> Supabase for auth/data, Stripe for
                billing, Resend for email, Telegram for alerts, and Google
                Analytics for usage measurement.
              </li>
              <li>
                <strong>Use:</strong> We use data to deliver the product,
                improve the model experience, prevent abuse, and provide
                support.
              </li>
              <li>
                <strong>Deletion:</strong> You can request data deletion by
                contacting support.
              </li>
              <li>
                <strong>No sale of data:</strong> We do not sell personal
                information.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-950">
              Risk Notice
            </h2>
            <p className="mt-4">
              Sports betting is risky. SharpSignal content is informational and
              educational. Use conservative unit sizing, understand local laws,
              and never wager money you cannot afford to lose.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-slate-500">
          Questions:{" "}
          <a
            href="mailto:SharpsSignal@gmail.com"
            className="font-semibold text-slate-950 hover:underline"
          >
            SharpsSignal@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
