# Conversion, campaign and retention reporting

The private `/analytics` page now separates observable browser attempts from Supabase Auth facts and Stripe payment facts. It keeps the existing click, page and scroll reports.

## Definitions

- **Submitted:** unique consented browser IDs with `signup_submit`. Not an account count.
- **Created / confirmed:** distinct accounts currently present in Auth, created within the selected 7/30/90-day window, using server-returned `created_at` and `email_confirmed_at`. Client `signup_success` never establishes either fact. QA owner IDs, trusted app QA flags and example.invalid accounts are excluded. Deleted Auth accounts are not recoverable in these totals; this is not an immutable signup ledger.
- **Activated:** a confirmed account viewed a released record at least half visible for five continuous seconds in a visible browser tab. The feed issues a 30-minute user-bound signed receipt; `/api/events` verifies the authenticated account and receipt before stamping `user_id`, `authenticated_record` and a SHA-256 record key. Proofs, raw record IDs and research content are not stored. Empty or paused feeds cannot issue qualifying record receipts. This is a viewing observation, not proof of understanding or wagering.
- **Returning:** another record key viewed at least 24 hours after the first qualifying view. Same-record refreshes and same-day browsing do not count.
- **Retention:** Monday signup cohorts in America/New_York, with cumulative returns within 7/30 elapsed days of signup. Denominators contain only accounts old enough for the entire window and with v2 consented signup attribution. Young windows stay pending; pre-instrumentation and unlinked accounts stay unmeasured. This is not exact-day retention. Consent changes/blockers can undercount activity; no cross-device anonymous fingerprinting is used. Authenticated record views associate a second device with the same account.

## Acquisition

At consented signup, `growth_acquisition` stores a version, random browser ID and first-touch `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` in account metadata. Auth timestamps and identity are server-verified; campaign labels are self-reported, editable attribution, never an authorization input. Older account sources are not guessed. Campaign tables report new accounts in the signup window and activity observed by report time; visitor counts cover page views in the same window, so these populations are not automatically a conversion-rate denominator.

Use one `utm_content` per post or email, for example:

`/?utm_source=x&utm_medium=social&utm_campaign=free_play_trial&utm_content=20261020_post1`

or:

`/?utm_source=newsletter&utm_medium=email&utm_campaign=free_play_trial&utm_content=20261022_email1`

This remains first-touch acquisition: a later post does not replace an earlier source. Multiple subsequent touches are not represented as causal attribution.

## Separate offers

- Free membership: signup view, submission, verified creation, confirmation, activation.
- Free-play email signup: **not configured**; no email capture or sending is silently added. A dedicated consent and confirmation flow is still needed before this can collect data.
- Subscription: plan view, checkout click, Stripe live paid subscription checkouts (`pro_telegram`).
- $5 interest: consented waitlist visibility/submission plus unique saved database entries, without selecting emails. A saved entry does not prove mailbox ownership or buying intent.
- Individual-pick purchase: shop view, dedicated checkout click, Stripe live paid one-time `product_type=pick` checkouts. QA, sandbox, unpaid and owner-verification sessions are excluded. Refunds do not erase an initial checkout; this is not net revenue.

Steps are independent totals with explicit units, not a rigid all-or-nothing journey. Existing visitors can skip signup and go directly to a plan or shop.

## Operation and privacy

No schema migration, new dependency or new secret is required. Existing `funnel_events.user_id`, JSON metadata, private `pick_waitlist`, Supabase service configuration and Stripe live key are reused. The service key only signs/verifies receipts on the server. No service key or account ID is sent to GA4. The report response contains aggregate counts only and stays behind the confirmed CEO allowlist check, with `private, no-store` caching.

Auth and waitlist pagination are bounded (10,000 rows each), events at 20,000, Stripe at 1,000 sessions. Read caps mark sources partial; missing/partial account or payment sources produce unavailable totals. Partial activity suppresses activation and retention rather than treating missing events as zero. Operational account facts can be counted independently of optional browser tracking. Record viewing and acquisition linking require browser analytics permission. The privacy notice and consent summary disclose account-linked return measurement.

Deploy all files together. Real v2 retention observations begin after deployment and need 7/30 days to mature. Existing accounts retain verified creation/confirmation facts but cannot gain invented historical activity. Confirm that Auth Admin reads and existing private tables are available in the deployed environment before relying on the new sections.

## Verification

- `node --test tests/growth-lifecycle.test.cjs tests/events-api.test.cjs tests/growth-analytics.test.cjs tests/feed-request.test.cjs`
- `npx tsc --noEmit`
- Local browser integration: start Next with the fake configuration below, then run `tests/growth-lifecycle.browser.cjs`. The script starts its own fake Auth/REST/feed service on 4015, tests real Next handlers and local event persistence, and saves screenshots under `work/`. It creates no real accounts, emails, purchases or wagers.

```sh
mkdir -p work
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4015 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-anon \
SUPABASE_SERVICE_ROLE_KEY=local-test-service \
CEO_DASHBOARD_EMAILS=owner@local.test \
MEMBER_FEED_BACKEND_URL=http://127.0.0.1:4015 \
npm run dev -- --hostname 127.0.0.1 --port 3015

# In a separate shell, with Playwright installed outside the application:
PLAYWRIGHT_MODULE=/path/to/playwright node tests/growth-lifecycle.browser.cjs
```
