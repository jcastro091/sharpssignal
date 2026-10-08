# Local auth and checkout safeguards

Base: `c3f2daf0e86e4acaff9d898dacfc4dadb614706d` (PR #7). Work is isolated on `codex/auth-checkout-safeguards`; no push, publication, deployment, live authentication, payment, database write, or invitation delivery.

## Behavior

- Sign-in, initial session lookup, callback completion, and navigation waits are bounded at 12 seconds. Retry messages replace indefinite waiting; superseded/unmounted attempts cannot overwrite current UI state. Sign-in reads its safe return destination after mounting, so both plain and query-bearing URLs work.
- Only allowed internal destinations survive authentication. `/picks` and the dashboard's logged-out redirect preserve allowlisted checkout status and session ID; other query fields are discarded.
- Verification requires a server-authenticated account, an exact server-bound `metadata.user_id` on both checkout and expanded subscription, the expected plan, subscription mode, a complete and paid checkout, and an active subscription. Legacy email-only sessions fail closed. Missing configuration and provider failures return a non-cacheable unavailable response. No entitlement writes or invite URLs remain in this handler.
- Dashboard checkout status offers checking, failed/retry, cancelled, and verified-but-not-activated states. Welcome copy no longer promises delivery.
- Public subscribe copy stays unchanged. A hard-disabled server gate also refuses checkout creation before customer/session/event writes. Enabling purchasing requires a separate reviewed code change.

## Verification

Run tests with an empty inherited environment (`env -i PATH="$PATH" ...`). No real credentials are needed.

- `node tests/auth-checkout.test.mjs`: stalled/successful/failed operations, late completion suppression, attempt invalidation, safe return context, wrong-account/unpaid/complete-but-unpaid/inactive-subscription rejection, missing configuration, no invitation disclosure, and actual creation handler refusal with inert dependencies.
- `node scripts/check-member-access.cjs`: safe redirects and existing admin fail-closed checks.
- `node tests/member-research.test.mjs` and `node scripts/verify-private-positioning.mjs`: existing first-use/positioning regressions.
- Targeted ESLint on changed application files; `git diff --check`.
- Production build with fake URL `http://127.0.0.1:4010` and fake public anon key, without service credentials. Build includes TypeScript validation; lint is checked separately because existing Next configuration skips it.
- `tests/auth-checkout.browser.cjs` uses local production server and `tests/mock-auth.cjs`. Browser external requests are blocked; auth, event, feed, and verification responses are mocked. Covers stalled auth/navigation, late error, retry, successful login, preserved redirects, disabled fulfillment, OTP, mobile layout, and unchanged purchase UI. Screenshot: `/tmp/sharpssignal-auth-checkout.png`.

## Remaining limits

Timeouts bound waiting; Supabase and Next navigation do not expose cancellation through these calls. An underlying request may still finish (including an already requested navigation), but late result handlers cannot overwrite a newer attempt. This does not repair a provider outage.

Legacy checkout creation did not bind authenticated user IDs, so existing email-only sessions cannot pass the new verifier. That is intentional: no email-based ownership fallback, live migration, or invitation activation is included. The follow-up webhook below can maintain account-bound paid entitlements; the browser verifier still never writes them. A later billing release needs approved price/currency/interval, the precise paid deliverable, server-bound checkout creation, approved price validation, durable entitlement/webhook reconciliation and fulfillment, and separate launch approval. This is a local safeguard change, not a revenue-ready checkout release.


## Narrow webhook follow-up

`pages/api/webhooks/stripe.js` now delegates to `lib/stripeWebhook.js`. Raw-body Stripe signature verification remains mandatory. Supported events are checkout completion, subscription update/deletion, and invoice payment. Current Stripe subscription state is retrieved rather than trusting a delayed event snapshot. Checkout grants require complete/paid subscription checkout and matching account metadata; renewals require a paid latest invoice belonging to the same customer/subscription. Existing verified database user/customer/subscription mappings may support renewals and cancellations when legacy metadata is absent. Missing mappings never fall back to email. Scheduled cancellation retains paid access while active; cancellation/past-due updates revoke it. Missing provider evidence produces retryable failure without silently erasing existing access.

`202610020001_verified_stripe_events.sql` is **local only and unapplied to any production database**. It atomically persists subscription state with an event ledger, locks event and subscription identities, rejects remapping and conflicting replay, ignores older updates, and rejects conflicting same-second updates. Those ambiguous same-second events need reconciliation before a retry can apply; the handler does not guess ordering. Identical duplicate events are acknowledged without another entitlement write. No security-critical columns are silently removed for old schemas. Missing migration returns 503 and must block deployment of this handler until separately approved migration/release sequencing is ready.

The webhook replaces its former best-effort funnel-event insert with the atomic `stripe_webhook_events` ledger; existing funnel analytics are not asserted to receive new webhook conversion events. No channel invitation is disclosed or delivered by this change.

Local verification: `tests/stripe-webhook.test.mjs` exercises the handler plus the actual SQL migration with PGlite 0.5.8 (in-memory PostgreSQL). Install the test-only package outside the repo with `npm install --prefix /tmp/sharpssignal-sql-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8`, then run `env -i PATH="$PATH" node tests/stripe-webhook.test.mjs`. `PGLITE_MODULE` can override that module path. Stripe calls are mocked; signature tests use the installed SDK with a local fake signing key. The embedded database test covers transactions and duplicate queued calls, not multi-process production concurrency or live Supabase permissions/configuration. Full-repository lint was not run; only targeted lint and build/type validation are claimed.

Out of scope and unchanged: unauthenticated `pages/api/send-welcome.js` can email the configured **free-channel** invite; Telegram account-link routes can create linking records. This is not a repo-wide claim that all email, invite, webhook, or write routes are disabled. Legacy subscriptions with no trusted account mapping still require explicit reconciliation. Pricing, fulfillment activation, and launch remain unapproved.

Stripe references: https://docs.stripe.com/webhooks (signature verification, duplicate deliveries, ordering) and https://docs.stripe.com/billing/subscriptions/webhooks (subscription and invoice lifecycle).
