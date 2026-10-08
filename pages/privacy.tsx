// pages/privacy.tsx

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 18px",
        lineHeight: 1.6,
      }}
    >
      <h1>SharpSignal Privacy Notice (AI + Automation)</h1>
      <p>
        <em>Last updated: October 8, 2026</em>
      </p>
      <h2>Optional website analytics</h2>
      <p>
        With your permission, we use Google Analytics and our own event storage
        to understand visits, referral sources, article reading, clicks, scroll
        depth, signup steps and checkout interest. Random browser and session
        identifiers connect these steps. They do not tell us who an anonymous
        reader is. We do not use fingerprinting.
      </p>
      <p>
        Heatmaps combine coarse click positions and scroll milestones. We do not
        record screens, keystrokes, form values, passwords, authentication links
        or private dashboard content. URLs are stripped of query strings and
        fragments before analytics collection. Campaign labels are retained
        separately. Auth and administrator pages are excluded from optional page
        tracking.
      </p>
      <p>
        Choose “No thanks” to decline optional analytics, or reopen “Analytics
        choices” in the footer to change your choice. We also honor Global
        Privacy Control and Do Not Track. Account, payment and security records
        needed to provide the service remain separate. Stripe records may
        include an anonymous visitor ID and campaign labels when analytics is
        allowed, so we can measure paid conversion.
      </p>
      <p>
        Optional event data is stored with our hosting/database providers;
        Google receives the consented Google Analytics events. The private
        reporting page shows up to 90 days. That reporting window is not an
        automatic deletion guarantee. Contact us to request deletion; clearing
        browser storage alone does not remove past server records.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account information (email, authentication identifiers)</li>
        <li>
          Subscription/payment metadata (via Stripe; we do not store full card
          details)
        </li>
        <li>
          Usage/event metadata (page views, basic product analytics if enabled)
        </li>
        <li>
          Operational logs required to run the service (timestamps, status,
          error codes)
        </li>
      </ul>

      <h2>What we do NOT collect (by default)</h2>
      <ul>
        <li>
          We do not intentionally collect sensitive personal data (e.g., SSNs,
          health data).
        </li>
        <li>
          We do not request device-level permissions beyond what the web app
          requires.
        </li>
      </ul>

      <h2>AI / model inputs</h2>
      <p>
        If SharpSignal includes AI-powered features (e.g., chat, summaries,
        assistants):
      </p>
      <ul>
        <li>We minimize the data included in model requests.</li>
        <li>
          We avoid sending personally identifying information (PII) unless
          required for the feature.
        </li>
        <li>
          We do not use user-provided AI inputs to train models unless
          explicitly disclosed and opt-in.
        </li>
      </ul>

      <h2>Data sharing &amp; third-party processors</h2>
      <p>
        SharpSignal uses third-party services strictly to operate the product.
        Examples may include:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> (payments/subscriptions)
        </li>
        <li>
          <strong>Telegram</strong> (notifications/alerts, if user opts in)
        </li>
        <li>
          <strong>The Odds API / data providers</strong> (sports data feeds)
        </li>
        <li>
          <strong>Google APIs</strong> (Sheets access for internal logging, if
          enabled)
        </li>
        <li>
          <strong>Cloud infrastructure providers</strong> (hosting, storage,
          logging)
        </li>
      </ul>
      <p>We only share the minimum necessary data to provide the service.</p>

      <h2>Data security</h2>
      <ul>
        <li>Least-privilege access for tokens/credentials</li>
        <li>
          Secrets stored in environment variables / managed secrets (not in
          source code)
        </li>
        <li>TLS/HTTPS for data in transit where applicable</li>
      </ul>

      <h2>User choices &amp; deletion requests</h2>
      <p>
        You may request deletion of your account data by contacting support. We
        will delete or anonymize data where feasible, subject to
        legal/operational requirements.
      </p>

      <h2>Contact</h2>
      <p>
        Support / privacy requests: <strong>SharpsSignal@gmail.com</strong>
      </p>
    </main>
  );
}
