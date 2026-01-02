// pages/retention.tsx

export default function RetentionPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 18px", lineHeight: 1.6 }}>
      <h1>SharpSignal Data Retention Policy</h1>
      <p><em>Last updated: 2026-01-01</em></p>

      <h2>Retention principles</h2>
      <ul>
        <li>Retain only what we need to operate, troubleshoot, and improve reliability.</li>
        <li>Minimize retention of raw user inputs and sensitive data.</li>
        <li>Prefer aggregated metrics over raw content.</li>
      </ul>

      <h2>What we retain and for how long</h2>

      <h3>Account &amp; billing records</h3>
      <ul>
        <li>Account identifiers and subscription status: retained while account is active.</li>
        <li>Billing/payment metadata: retained as required for accounting and compliance (Stripe is the system of record for payment details).</li>
      </ul>

      <h3>Operational logs</h3>
      <ul>
        <li>System logs (health checks, errors, job status): retained for a limited period to support debugging and reliability.</li>
        <li>Recommended default: 30–90 days.</li>
      </ul>

      <h3>Alerts &amp; notifications</h3>
      <ul>
        <li>If Telegram alerts are enabled, we may retain minimal alert metadata (timestamp, alert type, delivery status).</li>
        <li>Recommended default: 30–90 days.</li>
      </ul>

      <h3>AI inputs (if applicable)</h3>
      <ul>
        <li>We avoid storing raw prompts/messages by default.</li>
        <li>If prompts/messages must be stored for product functionality (e.g., conversation history), we retain them only as long as needed and allow deletion on request.</li>
      </ul>

      <h2>Deletion</h2>
      <ul>
        <li>Users may request account deletion and associated data removal where feasible.</li>
        <li>Some records may be retained longer if legally required (e.g., billing/audit obligations).</li>
      </ul>

      <h2>Third-party retention</h2>
      <p>
        Third-party services (e.g., Stripe, Telegram, data providers, cloud logs) may retain data under their own
        policies. We minimize what we send to them and avoid including sensitive data when not required.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy as the product evolves.</p>
    </main>
  );
}
