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

The hosted UI displayed SANDBOX MODE and reached the Caesars test login. Submission
is pending user confirmation because Login explicitly accepts SharpSports Terms
of Use. No dummy or real account has been linked yet, and imported-result,
reconnection and disconnect tests with the provider remain pending. Local API
verification does not establish deployed environment configuration.

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
