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
   The guard accepts `sandbox_` / `public_sandbox_` prefixes and rejects live keys.
   Verify the issued key format before changing this fail-closed guard.
3. Enable the provider's Native SDK toggle for the browser extension path.
4. Sign into Sharp Signals with a verified email, open `/results`, consent,
   prepare a connection and open the provider link. Use only provider test
   credentials (`gooduser` / `Test1`), never real sportsbook credentials.
5. Return and reload results. Exercise successful connection, failed login,
   2FA, repeat reads, separate customer identities and disconnect.

No paid subscription has been purchased. No sandbox key is available yet.
Local fixture tests are not a provider sandbox test. Auth-token response parsing
(`token`) must be confirmed against the issued sandbox account: the provider's
OpenAPI response schema is empty. Unexpected shapes fail closed.

## Limits and next verification

The desktop web extension is documented for FanDuel and DraftKings in Chrome;
mobile apps need a native SDK. iPhone Safari is not that integration path.
BetMGM/Caesars New York availability still needs an authenticated
`GET /v1/bookRegions?abbr=ny&support=true` check with the provider; do not advertise
all four as verified supported. Hosted linking chooses supported book/region.

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
