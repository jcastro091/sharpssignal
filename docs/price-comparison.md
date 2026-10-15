# Original signal and selected sportsbook prices

The latest sports signal cards and the opened tracking dialog show the unchanged signal odds/book/capture time alongside the best recently observed price among the user's chosen NY sportsbooks. The existing historical activity table remains the original research record. Tracking inputs continue to record the user's actual odds; they are not overwritten with a provider quote.

## Coverage and eligibility

Users explicitly choose New York and their own accessible sportsbook accounts. This release covers DraftKings, FanDuel, BetMGM and Caesars (`williamhill_us`). Location/account choices are saved only in browser localStorage and are not independent eligibility verification. Other locations show comparison unavailable. The UI links to the NY Gaming Commission's current operator list. It makes no claim to cover every operator or to verify account restrictions or execution.

## Data path

`PriceComparison` → `/api/price-comparison` (website, verified member session) → `/api/member-prices` (sports backend, bearer authorization) → existing member-feed authorization/publication/delay rules → exact released record lookup → event-specific Odds API request.

The backend requires the exact event ID, sport, home/away teams, commencement time (within 60 seconds), market, outcome and spread/total point. Missing identity, missing outcome, changed line, ambiguous outcome, invalid/future timestamp or missing source data cannot become a best quote. No nearest-line substitute is used. Only supported sportsbook keys can be requested. Provider credentials stay on the backend; no new environment variable or schema migration is required. Production already has the Odds API key configured.

Provider market timestamps take precedence over bookmaker timestamps. A valid quote is recent for 120 seconds; stale prices remain labelled in the expanded comparison and never rank as best. Browser timers re-evaluate freshness and game start every 15 seconds. Pregame comparison closes at the recorded game start or known settlement, rather than implying an in-play quote. Quotes are indicative provider observations, never a guaranteed sportsbook fill.

Provider reads are shared/cached for 60 seconds per process/event/market/book set, including failures, with a 100-entry cap. Authenticated bearer sessions have a 12-request/minute cap per process. These are instance-local protections, not a global spending guarantee. There is no automatic polling; the user can refresh. Only the three latest signal cards fetch comparisons automatically after preferences are set; tracking dialogs fetch when opened and reuse the browser cache. No wagers, account signups, alerts or purchases are placed by this feature.

## Verification

Frontend: `node --test tests/price-comparison.test.cjs tests/tracked-plays.test.cjs` and `npx tsc --noEmit`.

Backend: `node --test tests/test_member_prices.js tests/test_member_prices_route.js tests/test_member_feed.js`.

Local full-flow browser fixture (no real credentials, accounts, provider usage or bets):

```sh
mkdir -p work
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4025 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon \
SUPABASE_SERVICE_ROLE_KEY=local-service \
MEMBER_FEED_BACKEND_URL=http://127.0.0.1:4025 \
npm run dev -- --hostname 127.0.0.1 --port 3025

# In another shell; the browser script starts its own fake Auth/REST/provider service.
SPORTS_REPO=/path/to/updated/sports \
PLAYWRIGHT_MODULE=/path/to/playwright \
node tests/price-comparison.browser.cjs
```

The fixture uses the real frontend proxy and backend handler, checks -125 versus -122, dialog entry preservation, no hidden-dialog provider calls, mobile/desktop rendering, missing-book and closed-pregame states. Screenshots stay in `work/`.
