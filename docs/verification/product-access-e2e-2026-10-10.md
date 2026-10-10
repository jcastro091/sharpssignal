# Product access verification — October 10, 2026

## Production observations

Website commit `6d61f6d53a13f1b9bf9f776f665f5afd2c861c01` was verified READY at `www.sharps-signal.com` (deployment `dpl_He1w9S5pqs8jsHTRwZ93eYiUk8YF`). Backend commit `b41bd200f3332c8664fb3dea41c6f8cd08a8d0f7` was READY as `dpl_B2QEHSDeo2Myq54xRmeywfAWs2pZ`.

The existing signed-in account has a paid Sports subscription. Its billing page offered only a Sports invitation. Clicking the real invitation button created a Sports-only invitation in the production database, expiring at 2026-10-10 12:38 UTC. The invite remained unused; this is not proof of a new member admission. The existing account was not charged.

Changing the dashboard interests through the live UI to Markets only showed Markets navigation and delayed access. Sports only showed Sports navigation and paid real-time access. The original both-product preference was restored. Choosing checkout for the missing Markets product displayed $20/month on live Stripe Checkout. No live checkout was completed; the owner chose a separate sandbox.

The deployed website signup-notification test delivered `TEST—NO BET/NO TRADE` to Business, Telegram receipt 159. This synthetic producer check created no account or payment.

## Isolated Stripe sandbox

Stripe sandbox `acct_1UOrSA4TolAjW3Op`, provisioned with the official CLI, was separate from production and the owner's existing sandbox. Three hosted Checkout forms were submitted with Stripe's test card, fixture email addresses and fixture user IDs. No real funds moved.

| Purchase | Verified simulated amount | Product evidence | Result |
|---|---:|---|---|
| Sports | $20/month | sports | Passed |
| Markets | $20/month | markets | Passed |
| Both | $40/month | sports + markets | Passed |

`stripe-sandbox-2026-10-10.json` contains provider session/subscription receipts. The checker retrieved each completed paid session, active subscription, paid invoice, invoice payment, succeeded payment intent and captured/unrefunded charge from Stripe. Product metadata, server price and quantity were bound together. The same SQL grant function ran against an in-memory PGlite database with a test-only billing-mode guard; no production payment rows were inserted. SQL canonicalizes product ordering, so the assertion compares product sets.

Sports and Markets returned successfully through the local browser callback. Edge blocked the combined checkout's local return page. Its payment and grant were subsequently verified through direct Stripe API reads and isolated SQL, not by claiming a successful browser return.

All three test payments were rejected by production grant/admission helpers. No sandbox-derived Telegram invitation was sent. The actual production checkout handler was used to construct the test sessions with fixture auth and a sandbox offer adapter; its live-mode response guard correctly returned 503. Thus this is provider-integrated payment verification, not a complete production signup/payment/Telegram journey.

The sandbox Markets charge was refunded and the payment checker rejected it. All three sandbox subscriptions were canceled; the checker rejected each canceled subscription. No production subscription was changed.

## Automated verification and remaining gaps

21 tests passed across product checkout, actual dashboard SSR, billing/payment verification, customer journey and SQL access controls. Tests cover product scope, altered price/quantity/metadata, refunds, test-mode rejection, invite restrictions, role permissions and account linking. Provider/Telegram fixture tests are identified as such; they do not establish live member admission.

Still unverified: fresh customer signup, payment webhook delivery to a deployed isolated application, new Markets/both customer admission and subsequent Telegram membership removal. A separate Telegram test account is needed; the available account owns the channels. Production continues to reject sandbox payments.

The payment-inspection extraction and local harness on this branch are not deployed. Production remains on the commits above.

## Sandbox credential handling

A temporary sandbox key appeared in diagnostic tool output during setup. It has no production access. Its local credential files were removed after testing; the sandbox expires October 17, 2026. Remote key revocation was not verified. The test subscriptions were canceled and only sanitized receipts are stored here. Do not reuse that sandbox credential.

## Rerunning in a fresh sandbox

Provision a separate temporary sandbox using the official Stripe CLI. Save its JSON output privately outside the repository as `provision.log` under `SANDBOX_STATE_DIR`; never print or commit it. Set `PGLITE_MODULE` to an installed `@electric-sql/pglite` module and run `node scripts/stripe-sandbox-e2e.cjs`. Open the local URL and complete the three hosted test checkouts using Stripe test values. Run `node scripts/stripe-sandbox-e2e.cjs --verify-all --cleanup` to verify all sessions, test refund/cancellation rejection, and cancel the test subscriptions. The harness never loads production environment files or writes to Telegram/production storage.
