# PR8 Basil correction — local review only

Project: SharpSignalsDotCloud (`jcastro091/sharpssignal`). Remote branch `codex/auth-checkout-safeguards` was freshly cloned and verified at `776a9285f10e5898336bd13596f94e61f312cb58`. Isolated checkout: `/workspace/sharpssignal-pr8-localreview`, branch `local/pr8-basil-correction`. The existing `/workspace/sharpssignal` checkout was not modified.

## Two corrections

The lockfile installs Stripe 18.3.0, whose `cjs/apiVersion.js` specifies `2025-06-30.basil`. Its `types/Invoices.d.ts` defines `status` (including `paid`), with no `paid` boolean. Paid renewal eligibility now uses `status === "paid"`, preserving the expanded invoice, customer, subscription, account, plan, and existing binding checks. Checkout's separate complete/paid session and account checks remain intact.

The same SDK's `types/SubscriptionItems.d.ts` places `current_period_end` on subscription items. `Invoices.d.ts` describes invoice `period_end` as the preceding usage period. Persistence now derives the service end from the complete subscription item list, with matching subscription identity, positive safe integer timestamps within the JavaScript date range, and a shared end across all items. There is no fallback to the invoice usage period or removed subscription-level field. Missing, paginated, invalid, or mixed-period items fail closed for active access without overwriting an existing entitlement; inactive subscriptions can still revoke access with a null period. Mixed-period billing needs an explicit price-to-entitlement mapping before support can be broadened.

Official references, checked against the installed pinned SDK types:

- [Basil Invoice object](https://docs.stripe.com/api/invoices/object?api-version=2025-06-30.basil)
- [Basil Subscription Item object](https://docs.stripe.com/api/subscription_items/object?api-version=2025-06-30.basil)
- [Stripe 18.3.0 Invoice types](https://github.com/stripe/stripe-node/blob/v18.3.0/types/Invoices.d.ts)
- [Stripe 18.3.0 Subscription Item types](https://github.com/stripe/stripe-node/blob/v18.3.0/types/SubscriptionItems.d.ts)

## Local evidence

- Published source and original fixtures: **29 webhook/SQL checks passed**, independently in `/tmp/pr8-baseline-review` before applying corrections there.
- Basil fixtures against published source: renewal fails with `latest_invoice_unpaid_or_missing`.
- Basil fixtures with only the obsolete boolean check removed: renewal persists invoice usage end `1000` instead of item service end `3000`.
- Corrected source: **46 webhook/SQL checks passed** (the existing 29 cases plus 17 new cases). Fixtures omit removed fields, use `parent.subscription_details.subscription`, and intentionally differ between invoice usage end and item service end. Recovery and scheduled cancellation also exercise HTTP acknowledgment and SQL persistence. Negative cases retain prior access without writes; canceled/past-due cases revoke it.
- Targeted ESLint passed for `lib/stripeWebhook.js` and `tests/stripe-webhook.test.mjs`; `git diff --check` passed. Full-repository lint was not run.
- `tests/auth-checkout.test.mjs`, `scripts/check-member-access.cjs`, and `scripts/verify-private-positioning.mjs` passed, including the actual disabled checkout route with inert dependencies.
- Production build passed with TypeScript validation, empty inherited environment, loopback fake public Supabase URL, fake anon key, and no service credentials. Existing Next configuration skips build lint; only the targeted lint result above is claimed.

Reproduce the SQL suite after `npm ci --ignore-scripts`:

```sh
npm install --prefix /tmp/pr8-local-sql --cache /tmp/pr8-pglite-cache --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
env -i PATH="$PATH" PGLITE_MODULE=/tmp/pr8-local-sql/node_modules/@electric-sql/pglite node tests/stripe-webhook.test.mjs
```

Logs from this run are in `/tmp/pr8-original-29.log`, `/tmp/pr8-basil-status-regression.log`, `/tmp/pr8-basil-period-regression.log`, and `/tmp/pr8-local-build.log`. All Stripe interactions in tests are fakes or local signature generation/verification; SQL runs in in-memory PGlite.

## Remaining limits and release blockers

Legacy email-only records still cannot establish ownership; trusted account/customer/subscription reconciliation is required. Conflicting same-second events still fail atomically and need explicit reconciliation; this patch does not invent an ordering. The existing SQL migration is unchanged and was applied only inside disposable PGlite tests. Missing production migration remains a 503/deployment blocker until separate migration and release coordination. PGlite checks do not establish live Supabase configuration or multi-process production concurrency.

No push, PR update, merge, deployment, live Stripe/payment/auth request, production database write, migration rollout, credential/configuration change, or customer-data alteration was performed. Public purchasing remains disabled. This is a two-bug local correction, not billing launch approval. Any future push requires parent coordination.
