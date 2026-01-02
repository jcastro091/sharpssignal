# SharpSignal Data Retention Policy

Last updated: 2026-01-01

## Retention principles
- Retain only what we need to operate, troubleshoot, and improve reliability.
- Minimize retention of raw user inputs and sensitive data.
- Prefer aggregated metrics over raw content.

## What we retain and for how long
### Account & billing records
- Account identifiers and subscription status: retained while account is active.
- Billing/payment metadata: retained as required for accounting and compliance (Stripe is the system of record for payment details).

### Operational logs
- System logs (health checks, errors, job status): retained for a limited period to support debugging and reliability.
- Recommended default: 30–90 days.

### Alerts & notifications
- If Telegram alerts are enabled, we may retain minimal alert metadata (timestamp, alert type, delivery status).
- Recommended default: 30–90 days.

### AI inputs (if applicable)
- If AI features exist, we avoid storing raw prompts/messages by default.
- If prompts/messages must be stored for product functionality (e.g., conversation history), we retain them only as long as needed for that feature and allow deletion on request.

## Deletion
- Users may request account deletion and associated data removal where feasible.
- Some records may be retained longer if legally required (e.g., billing/audit obligations).

## Third-party retention
Third-party services (e.g., Stripe, Telegram, data providers, cloud logs) may retain data under their own policies. We minimize what we send to them and avoid including sensitive data when not required.

## Changes
We may update this policy as the product evolves.
