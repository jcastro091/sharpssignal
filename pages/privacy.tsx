// pages/privacy.tsx

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 18px", lineHeight: 1.6 }}>
      <h1>SharpSignal Privacy Notice (AI + Automation)</h1>
      <p><em>Last updated: 2026-01-01</em></p>

      <h2>What we collect</h2>
      <ul>
        <li>Account information (email, authentication identifiers)</li>
        <li>Subscription/payment metadata (via Stripe; we do not store full card details)</li>
        <li>Usage/event metadata (page views, basic product analytics if enabled)</li>
        <li>Operational logs required to run the service (timestamps, status, error codes)</li>
      </ul>

      <h2>What we do NOT collect (by default)</h2>
      <ul>
        <li>We do not intentionally collect sensitive personal data (e.g., SSNs, health data).</li>
        <li>We do not request device-level permissions beyond what the web app requires.</li>
      </ul>

      <h2>AI / model inputs</h2>
      <p>
        If SharpSignal includes AI-powered features (e.g., chat, summaries, assistants):
      </p>
      <ul>
        <li>We minimize the data included in model requests.</li>
        <li>We avoid sending personally identifying information (PII) unless required for the feature.</li>
        <li>We do not use user-provided AI inputs to train models unless explicitly disclosed and opt-in.</li>
      </ul>

      <h2>Data sharing &amp; third-party processors</h2>
      <p>SharpSignal uses third-party services strictly to operate the product. Examples may include:</p>
      <ul>
        <li><strong>Stripe</strong> (payments/subscriptions)</li>
        <li><strong>Telegram</strong> (notifications/alerts, if user opts in)</li>
        <li><strong>The Odds API / data providers</strong> (sports data feeds)</li>
        <li><strong>Google APIs</strong> (Sheets access for internal logging, if enabled)</li>
        <li><strong>Cloud infrastructure providers</strong> (hosting, storage, logging)</li>
      </ul>
      <p>We only share the minimum necessary data to provide the service.</p>

      <h2>Data security</h2>
      <ul>
        <li>Least-privilege access for tokens/credentials</li>
        <li>Secrets stored in environment variables / managed secrets (not in source code)</li>
        <li>TLS/HTTPS for data in transit where applicable</li>
      </ul>

      <h2>User choices &amp; deletion requests</h2>
      <p>
        You may request deletion of your account data by contacting support. We will delete or anonymize
        data where feasible, subject to legal/operational requirements.
      </p>

      <h2>Contact</h2>
      <p>
        Support / privacy requests: <strong>support@sharps-signal.com</strong> (change if needed)
      </p>
    </main>
  );
}
