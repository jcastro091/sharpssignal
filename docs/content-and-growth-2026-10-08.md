# Article and website measurement

Article: `/blog/why-we-passed-marlins-diamondbacks`. Source: the September 17 MLB window audit, seven rows for event `e9344aee4810e4127e69c73c13c781d7`. The published JSON is a narrow, non-personal extract with the original audit SHA-256. Exact selected side, offered sportsbook odds, final result, profitability and whole-game execution are not established by that extract and are not invented. `WATCH` is preserved and explained; the article's use of “passed” refers to the unconfirmed sequence.

Editorial checks: original seven rows, exact time conversion (six UTC September 16 rows are September 15 EDT), rounding (+2.32%, −1.55%), 332.401-second interval, no fabricated quote or outcome, readable mobile table, source download, title/description/canonical/structured data, navigation, sitemap and signup CTA. Organization byline avoids claiming a personal interview or experience that was not supplied.

## Reporting

Open `/admin` → Website analytics (`/analytics`). Existing verified admin allowlist protects the page and API. Optional analytics requires permission and honors GPC/DNT. No form contents, screen recording, authentication tokens, full URL query strings or email addresses enter the new browser collector. Signup is a browser-reported completion with possible confirmation pending. Anonymous IDs approximate people, not authenticated identities. Stripe paid subscription checkouts are read server-side; client payment claims are rejected. No test purchase or real customer contact is part of this release.

Metrics: page views, approximate unique visitors, 30 active seconds, article reading (30 active seconds plus 75% depth), 25/50/75/90% scroll reach, coarse click density by device and page, most clicked destinations, source/campaign, signup intent/attempt/success, plan views and checkout intent/errors. Funnel requires steps in chronological order. Skipped steps are visible in the separate activity counts. Client times are bounded to five minutes of server time and preserve local order. Payments before checkout interest do not count as ordered conversions.

Paid checkout metadata retains consented anonymous visitor/session IDs and bounded campaign fields. The reporting API uses live Stripe `complete` + `paid` subscription sessions with a positive amount and `pro_telegram` plan. QA and test-mode sessions are excluded. Checkout completion is not renewal, net revenue or current access. Missing Stripe access displays unknown, not zero. Same browser across devices is not assumed. Existing historical payments may be unattributed.

First-party reporting uses revision `2026-10-08-v1`, 7/30/90-day windows, bounded 500-row pagination (20,000 max), explicit truncation, no silent database-write success. Tests and localhost traffic are excluded. Add `?analytics_test=1` for browser QA; its tab remains labelled until session storage is cleared. GA is disabled for QA, private/auth paths, declined consent and GPC/DNT. First-party reporting is the conversion source of truth; GA is supplementary.

Heatmap is an aggregate 10×10 spatial grid, not a screenshot overlay or session replay. Percent-of-document coordinates vary with page length; compare mobile/desktop separately and do not combine future layout revisions. No external heatmap subscription required.

## Distribution and decisions

Suggested X link (not posted): `https://www.sharps-signal.com/blog/why-we-passed-marlins-diamondbacks?utm_source=x&utm_medium=social&utm_campaign=why_we_passed&utm_content=launch_post`

Use distinct `utm_content` for each post or DM and `utm_source=email&utm_medium=email` for email. Do not put names, email addresses or other personal data in campaign labels.

At the first review, record traffic and denominators before rates. Low traffic asks a distribution question; low reading asks a content question; reading without CTA clicks asks an offer question; signup or checkout errors ask a product question. Small samples do not establish a winning channel. Interview interested users before increasing feature scope. This document does not authorize sending messages or schedule recurring work.

Verification commands: `node --test tests/growth-analytics.test.cjs tests/events-api.test.cjs tests/customer-journey.test.cjs tests/realtime-billing.test.cjs tests/telegram-destination.test.cjs`; `npm run build` with the existing private environment loaded. Production evidence is recorded separately after deployment.
