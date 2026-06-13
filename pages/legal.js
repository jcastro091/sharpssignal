export default function LegalPage() {
  return (
    <main className="bg-white text-slate-950">
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-bold">SharpSignal Legal</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: June 13, 2026</p>

        <div className="mt-10 space-y-10 leading-7 text-slate-700">
          <section id="terms">
            <h2 className="text-2xl font-semibold text-slate-950">Terms of Service</h2>
            <p className="mt-4">
              SharpSignal provides sports betting information, model-generated picks, dashboard analytics, and
              optional Telegram alerts. We do not place bets, execute transactions, or manage bankrolls for users.
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li><strong>No guarantees:</strong> Past performance does not guarantee future results.</li>
              <li><strong>User responsibility:</strong> You are responsible for any wagering or financial decision you make.</li>
              <li><strong>Subscriptions:</strong> Stripe manages paid subscriptions. You may cancel according to Stripe checkout terms.</li>
              <li><strong>Access:</strong> Telegram access is provided after payment verification and may be revoked for abuse or redistribution.</li>
              <li><strong>Acceptable use:</strong> Do not resell, scrape, or automate redistribution of SharpSignal alerts without written permission.</li>
            </ul>
          </section>

          <section id="privacy">
            <h2 className="text-2xl font-semibold text-slate-950">Privacy Policy</h2>
            <p className="mt-4">
              We collect the minimum data needed to authenticate users, provide alerts, manage billing, measure
              product performance, and respond to support requests.
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li><strong>Data collected:</strong> Email, login metadata, subscription metadata, Telegram access events, and dashboard analytics.</li>
              <li><strong>Vendors:</strong> Supabase for auth/data, Stripe for billing, Resend for email, Telegram for alerts, and Google Analytics for usage measurement.</li>
              <li><strong>Use:</strong> We use data to deliver the product, improve the model experience, prevent abuse, and provide support.</li>
              <li><strong>Deletion:</strong> You can request data deletion by contacting support.</li>
              <li><strong>No sale of data:</strong> We do not sell personal information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-950">Risk Notice</h2>
            <p className="mt-4">
              Sports betting is risky. SharpSignal content is informational and educational. Use conservative unit
              sizing, understand local laws, and never wager money you cannot afford to lose.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-slate-500">
          Questions: <a href="mailto:SharpSignal@gmail.com" className="font-semibold text-slate-950 hover:underline">SharpSignal@gmail.com</a>
        </p>
      </section>
    </main>
  );
}
