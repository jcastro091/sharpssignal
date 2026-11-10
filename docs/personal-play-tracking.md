# Personal play tracking

Owner decision, October 11, 2026: decline the $500/month sportsbook integrator and
use a dashboard “Tail this pick” action with a personal results dashboard instead.
No SharpSports subscription was purchased or live sportsbook account connected.

`/dashboard` links to `/my-plays` and presents Tail this pick on upcoming sports
records. The confirmation captures the user's actual sportsbook, American odds,
USD stake, and confirmation of the exact displayed side and line. It records a
self-reported play; it never places a wager. Started and settled records cannot
be newly tailed. Repeated saves preserve the first snapshot and entered details.

`/api/tracked-plays` verifies the confirmed Supabase user, requires same-origin
mutations, and fetches that customer's authorized feed before accepting a pick.
The service-only `customer_tracked_plays` table keys ownership to `auth.users.id`
with cascade deletion and denies browser-role access. Records are separate from
`tail_bets`, funded pilot data and sportsbook imports. Telegram's older ledger
remains linked separately; it is not added into these totals.

Grading reads the newest archived snapshot for the exact cohort, source entry,
selection and line; it works beyond the current 100-row feed. Verified final
results are available immediately for already-owned selection snapshots; new-pick discovery keeps its publication delay. The newest archived
version is authoritative, so a correction cannot reuse an older final. Unknown
outcomes remain pending. Publication pause suppresses grading. The existing
background research sync supplies grades without requiring a page visit. My Plays
checks every minute while visible, and when focus returns, without overlapping
a load or question request. Reads also calculate grades automatically.
Accounting uses integer cents, the user's odds, graded stake for ROI, and excludes
void stake and all pending plays from ROI. The latest 1,000 tracked plays are
shown; a limit notice scopes totals and questions when this history is exceeded.

AI classifies only the question into a constrained dimension/direction/metric.
Identities and play records are never sent to the model. Calculations use only
the authenticated user's filtered rows. Requests to predict results, access
others, or add unsupported filters are rejected with guidance. A per-instance
question throttle, 500-character cap, timeout and no retries bound requests;
this is not a global account spending quota. Existing configured OpenAI access
is reused; no new integrator subscription is required.

Verification (October 11):
- Nine focused auth/accounting/route tests, TypeScript, and member-access checks passed.
- Production build and Vercel preview are READY.
- Real disposable-customer preview checks passed: anonymous/cross-origin rejection,
  separate customer reads, archived result calculation ($10 at +150 => $15 profit,
  150% ROI), AI question response, authenticated pages, and denied direct table reads.
- Browser test used a clearly labelled local fixture feed with real Supabase auth
  and persistence. Tail confirmation saved $25; My plays displayed one pending
  FanDuel slip and $25 open stake, and questions honestly reported no graded plays.
- Narrow-screen review at 390px had no horizontal document overflow.
- No upcoming naturally released pick was available during verification. Natural
  live saving and later settlement are not claimed; the save path was exercised
  through the real UI/API using the local fixture. Disposable data is removed.
- Supabase security checks confirmed RLS, no anonymous table reads, no authenticated
  direct writes, and no anonymous grading RPC execution. No-policy INFO is the
  intended service-only deny policy; pre-existing unrelated advisories were not changed.

Production release verification is recorded in the PR after deployment.

November 10 automatic grading verification:
- Production result RPC returned both repaired NCAA grades before the former 30-minute cutoff.
- Transactional database regression checks proved immediate verified finals, pending exclusion, and invalidation of an older final by a newer unresolved version; all fixtures rolled back.
- Service-only function permissions remain enforced; no browser role can execute the lookup directly.
- Nine focused ownership, accounting, exact-source and refresh tests passed.
- Production build passed. A browser integration exercised the real page and API against a labelled local auth/database fixture: pending plays changed to win/loss on the minute timer without a click, P&L used entered odds, and a 390px viewport fit without overflow.
- The broader local suite had pre-existing harness/environment failures (missing optional PGlite and a data-URL relative import in member-research tests); it is not claimed fully passed.

Delete a tracked play by expanding its bet slip and choosing **Delete play**.
Confirmation explains that the play will be removed from personal totals and
cannot be undone. The server deletes only the supplied play ID scoped to the
confirmed signed-in user's ID; a different user's ID in the request is ignored.
Missing and unowned records return the same not-found response. Anonymous and
cross-origin mutations are rejected. Saved research records and other customers'
plays are unaffected. The page pauses automatic refresh while deletion is in
progress, keeps the play on failure, and reloads personal totals after success.

Delete verification (November 10): 12 focused ownership/accounting/refresh tests
and the production build passed. Browser integration used only local fixture
data to check cancellation, failure preservation, confirmed deletion, recomputed
totals, persistence after reload and automatic refresh, and the delete action at
390px width. No existing customer play was deleted during verification.
