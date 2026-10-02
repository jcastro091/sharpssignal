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

Legacy checkout creation did not bind authenticated user IDs, so existing email-only sessions cannot pass the new verifier. That is intentional: no email-based ownership fallback, live migration, entitlement creation, or invitation activation is included. A later billing release needs approved price/currency/interval, the precise paid deliverable, server-bound checkout creation, approved price validation, durable entitlement/webhook reconciliation and fulfillment, and separate launch approval. This is a local safeguard change, not a revenue-ready checkout release.
