# Customer sportsbook results — sandbox pilot

Requested October 7, 2026: read-only customer results for FanDuel, BetMGM,
Caesars and DraftKings. User explicitly selected sandbox first. This is an
integration candidate, not a verified live connection or assertion of operator approval.

`/results` uses the existing verified Supabase session. The API derives a stable
opaque provider identity from that user; callers cannot choose another user.
Provider responses are filtered by bettor and accessible account before display.
No imported slips or sportsbook passwords are stored in our database. The view
shows up to 100 provider slips and counts each slip once, including parlays.
Amounts are provider-reported cents. Missing results stay unknown. Cashouts and
partial outcomes use reported net profit rather than inferred payout formulas.
This data is separate from our paper research and is never used as strategy evidence.

## Setup needed

1. Create a developer account at https://app.sharpsports.io/ and remain in sandbox.
2. Set server environment variables `SHARPSPORTS_SANDBOX_KEY`,
   `SHARPSPORTS_IDENTITY_SECRET` (stable random 32+ characters), and
   `SHARPSPORTS_SANDBOX_ENABLED=true`. Never paste keys in source or reports.
   The provider documents one sandbox key for public and private requests.
   Set `SHARPSPORTS_SANDBOX_KEY_SHA256` to the SHA-256 fingerprint of the key
   independently confirmed in the provider's sandbox console. The issued key
   has no sandbox prefix. The guard requires that pin and rejects substitutions;
   its format alone cannot prove the environment. Do not pin a live key.
3. Enable the provider's Native SDK toggle for the browser extension path.
4. Sign into Sharp Signals with a verified email, open `/results`, consent,
   prepare a connection and open the provider link. Use only provider test
   credentials (`gooduser` / `Test1`), never real sportsbook credentials.
5. Return and reload results. Exercise successful connection, failed login,
   2FA, repeat reads, separate customer identities and disconnect.

No paid subscription has been purchased. The user supplied a screenshot explicitly
labelled Sandbox API Key on October 7. The key was extracted into ignored local
configuration without printing it, then independently pinned. Authenticated
requests returned HTTP 200 for books, New York regions, extension authorization
and linking context creation. The real auth response contains `token`, and the
context response supplies a valid `cid`. The results handler returned a truthful
empty account/slip list before linking. Eleven security/accounting tests passed.

The user explicitly approved Terms acceptance, and the hosted UI confirmed the
Caesars dummy account linked successfully. The results handler imported 69 slips
initially and reached its 100-slip view limit as the sandbox populated. A second
test customer received no accounts or slips and could not disconnect the owner's
account. The owner's disconnect returned 200; the following read returned zero
accounts and slips. No real sportsbook account was accessed. Reconnection and
SDK-required-book tests remain pending. Local API verification does not establish
deployed environment configuration. Verification: October 7, 2026, 12:21 UTC;
nonsecret evidence is in ignored `out/sandbox-integration-evidence.json`.

## Cloud runtime and PC independence

On October 7, the four sandbox configuration values were provisioned as Vercel
Secrets for project `sharpssignal`, Preview only, branch `codex/customer-results`.
Deployment `dpl_AtAJs1usr2XDgTmDJ2dKtSpkzVyE` runs commit
`f372e494a0eac8a21acbc93f5e66daa58536e726` with that configuration:
https://sharpssignal-akhdwdqgu-jcastro091s-projects.vercel.app/results

A disposable verified Supabase customer exercised the deployed API: configuration
200 with sandbox enabled, results 200 with an empty account list, server-rendered
results page 200, and linking context creation 200 through the real SharpSports
API. Anonymous requests returned 401; a cross-origin mutation returned 403.
The disposable auth account was deleted afterward. Vercel Deployment Protection
remains enabled; use the owner's Vercel login to view this preview. This is not a
production launch or a real sportsbook connection.

The hosted preview needs no running PC. Codex Cloud is a separate development
environment; it does not host this website. Future development can use the
GitHub branch/PR and Vercel's stored secrets without reading a PC's env file.
Codex environment network policy still controls what a cloud coding task can
call. X scheduling already runs independently in AWS Lambda/EventBridge, with
credentials in SSM. A cloud task's inability to call Lambda does not stop that
schedule. This local Codex desktop task requires the PC to keep doing local work.

## Limits and next verification

Authenticated `GET /v1/bookRegions?abbr=ny&support=true` reports all four target
books active in New York in the sandbox catalog. FanDuel, DraftKings and BetMGM
require an SDK and report Chrome extension support; Caesars reports no SDK
requirement. Mobile apps need a native SDK for the first three. iPhone Safari is
not that integration path. Catalog status does not establish working live access.
Hosted linking without an initialized extension offered Caesars but hid the
SDK-required books, consistent with that distinction.

Reload reads saved provider history; it does not trigger a sportsbook refresh.
There is no background sync, signed webhook ingestion, persistent import ledger,
or full-history pagination in this pilot. Disconnect removes provider access;
it is not a promise to erase data retained by the provider. Before a production
rollout, verify coverage, provider terms and pricing, privacy/retention disclosures,
sync cadence, rate limits, deletion behavior, and multi-customer isolation with
real sandbox sessions. Live mode requires a separately reviewed implementation.

## Sources inspected

- https://docs.sharpsports.io/reference/public-vs-private-api-keys-1
- https://docs.sharpsports.io/reference/chrome-browser-extension
- https://docs.sharpsports.io/reference/browser-extension-auth-token
- https://docs.sharpsports.io/reference/betsync-context
- https://docs.sharpsports.io/reference/bettor-detail
- https://docs.sharpsports.io/reference/bettoraccounts-by-bettor
- https://docs.sharpsports.io/reference/betslips-by-bettor
- https://docs.sharpsports.io/reference/betslip
- https://docs.sharpsports.io/reference/remove-access-for-bettoraccount
- https://docs.sharpsports.io/reference/fanduel
- https://docs.sharpsports.io/reference/draftkings

The quickstart and detailed reference disagree on some example data shapes and
currency units; the detailed BetSlip reference supplies the integer-cent schema
used here. Validation must use actual sandbox responses before enabling access.

## Continuation — October 8, 2026

Recovered the existing draft PR #9 after discovering that the main checkout did
not contain the sandbox work. The previously deployed preview remains READY;
an unauthenticated fetch of /results redirects to the website sign-in page.

Added expandable imported receipts with sportsbook reference, provider slip ID,
wager odds, original potential profit, promotion-adjusted stake, settlement
timestamp/date and individual parlay legs. These are provider-reported records,
not original sportsbook receipt images. Missing values remain unavailable;
cashout net profit remains separate from original potential profit. Parlay legs
are never added as separate wagers to the totals.

Added a consent-gated Reconnect control. Withdrawing consent invalidates the
prepared linking URL. Reload clears prior result data before session/provider
checks, and failures offer a retry so expired sessions do not retain an old
receipt view.

Fourteen API/security/accounting checks passed locally before the cloud
environment restarted, including receipt fields, zero-valued lines and stakes,
cashouts, missing values, customer isolation and disconnect. Existing member
redirect/admin checks also passed. Interactive browser fixture verification was
blocked by the sandbox's local network permission and interrupted; it did not
pass. Actual website-session linking, provider reconnection and SDK-required
sportsbooks remain unverified. No new provider account was linked during this
continuation, and no real sportsbook account or live credential was used.

Validation commands:
- node scripts/check-sportsbook-results.cjs
- node scripts/check-member-access.cjs
- npm run build

Continue sandbox-only verification through the protected Preview. A signed-in
customer session and provider extension support are needed to complete the
remaining interactive checks. This continuation does not authorize a live-mode
rollout.

## October 11 — consolidated dashboard and live-pilot preparation

The owner selected FanDuel for the first real-account test. `/results` now shows
provider slips, open exposure, settled P&L, cash-stake ROI, sportsbook/market
comparisons, date/book/market filters and expandable receipts. The workspace
navigation links to it. Manual/Telegram bets remain a linked, separate ledger:
no heuristic combines them with provider slips and double-counts a wager.

History reads use the documented pageSize/pageNum response, up to 20 pages of
100 records. A capped response is explicitly partial. Filters apply to imported
placement dates in UTC; the Open/Settled selector only changes the receipt list.
No background sync, original receipt images, or webhook persistence is claimed.
Unknown accounting stays unknown; cashout and partial settlements use the
provider netProfit. ROI uses settled rows with known profit and positive actual
stake, using adjusted stake when supplied. Zero-stake promotions are excluded
from ROI, but their reported profit remains in net P&L. Parlays have one P&L and
a separate market group; leg stakes/results are never summed.

The question endpoint authenticates again, retrieves that customer's provider
history and computes its own numbers. The AI receives only the bounded question
and classifies dimension, direction and metric. It receives no customer identity
or imported bets and cannot execute SQL, make provider requests, change accounts,
or choose another customer. Questions requesting new date or named-group
constraints ask the customer to set dashboard filters. OPENAI_MODEL remains the
existing configured default; BET_INSIGHTS_MODEL can override it. The original
public signal assistant remains retired.

Live configuration is separate from sandbox:
- SHARPSPORTS_MODE=live
- SHARPSPORTS_PUBLIC_KEY and SHARPSPORTS_PRIVATE_KEY: distinct live keys
- SHARPSPORTS_IDENTITY_SECRET: retain a stable secret, never rotate casually
- SHARPSPORTS_PILOT_USER_IDS: the verified owner's Supabase user ID

The allowlist is mandatory and enforced server-side. Live provider identities
use a different prefix, preventing sandbox records from entering live results.
No live keys were found or provisioned during this work. The existing branch
Preview remains sandbox. No plan purchase, FanDuel login, or real-account E2E
success has occurred. Live enablement needs the provider's live developer
configuration and the owner's Chrome extension/login flow. Never submit a real
sportsbook password to the sandbox UI or to Sharp Signals.

Verification performed:
- 22 accounting/security/provider-handler tests passed.
- Production build passed with isolated mock auth configuration.
- Existing safe redirect/admin checks passed.
- A real SharpSports sandbox read returned HTTP 200, zero accessible accounts
  and zero imported slips, consistent with the earlier disconnect.
- The configured OpenAI account advertised gpt-4.1-mini. Five live AI calls
  correctly classified book losses, market profit and league ROI, and rejected
  unsupported named-book/date and cross-customer requests.
- Browser and deployed preview verification are recorded in the task report.

Remaining production work: actual FanDuel linking, reconciliation against real
slips, provider commercial/live entitlement, SDK flow, sync/reconnect behavior,
and live multi-customer isolation. This is an owner pilot, not a general release.
