# Sports explanation and first-use review

Local implementation only. No push, merge, deployment, customer contact, live signup, billing, trading, or Telegram action is part of this change.

## Baseline and scope

- Repository root: `/workspace/sharpssignal`; origin: `https://github.com/jcastro091/sharpssignal.git`.
- Branch: `codex/sports-first-use`.
- Base: `c32b5c44eac0133b9dc96b4c8f609c6f76542bf1`, fetched from `codex/member-brand-refresh` on October 1, 2026.
- Base contains `23943bedf28807009e3d7639ee893f139b16b7ed` plus `7ec00ba` (publication identity) and `c32b5c4` (email sender handling). These later fixes are preserved.
- The live homepage at `https://www.sharps-signal.com` was fetched read-only and confirmed to contain “Less noise.”, “More signal.”, “Find your signal”, `/signup`, and “Explore the preview”. `main` at `1c3cdc7` has the older design and is not the implementation baseline. The public HTML supports design correspondence; it does not independently disclose a deployment Git SHA.
- No `AGENTS.md` or `.agents/skills` exists in the website checkout, its fetched baseline, or the workspace ancestor. `/workspace/sports` is a separate repository; its AGENTS instructions were read for context, but no backend/business-plan mutation was made. Customer recruitment and shared business reporting remain with the parent.

## Changes

- `pages/index.js`: retain the existing headline, signup CTA, preview CTA, palette, layout and verification callout; explain free sports research from captured odds to paper results. Markets remains a separate optional interest.
- `components/SignalPreview.js`, `pages/picks-preview.tsx`: clearly fictional teams and price, pending result, unavailable closing price; no invented outcome, performance chart or private historical selection.
- `components/ResearchGuide.js`: brief explanation of entry odds, paper grading and closing-price evidence. Raw closing prices are not supplied by the existing member feed; the UI explicitly says so.
- `pages/signup.js`: Sports selected by default, Markets optional, simpler email/password form, no optional unused phone input or phone metadata writes. Existing stored data/authentication is not deleted or migrated. Free/no-card and inactive email/SMS/push alert statements retained.
- `pages/dashboard.js`: guide, “Open a record” action preferring a settled available record (including losses), inspectable record summary, example fallback, refresh/retry, optional fixed-choice clarity feedback. Uses the existing authenticated member endpoint without new permissions or review/admin queries.
- `components/ResearchStatus.js`, `lib/memberResearch.js`: reusable status derived only from the authorized response. Empty publication, explicit no-qualifying status, pending outcomes, stale observations, paused publication and unavailable data are distinct. Counts refer only to displayed member records, not all research. Unknown data produces an unavailable state, not optimistic numbers.
- `lib/memberAnalytics.js`, `components/FunnelTracker.js`, `pages/api/events.js`: existing first-party event endpoint reused for signup view/submit/success, dashboard view, record open, guide open and optional feedback. New member events allow fixed fields only; no email, record ID, free text, visitor identity, referrer or URL. Preview visits no longer falsely count as signup-page views. Events count actions, not unique users or validated conversions. Legacy analytics outside this flow is unchanged.
- `pages/contact.js`, `pages/legal.js`: John resolved the support choice to `SharpsSignal@gmail.com`; visible links now match the footer. No legal terms, unrelated addresses or privacy commitments changed.
- `styles/brand.css`: small additions for the guide, record links and wrapping. Existing brand rules retained.
- `tests/`: state/privacy tests, browser flow, and local mock-auth fixture.

Some existing one-line JSX files were formatted for a reviewable implementation.

## Verification

Passed against final application changes:

- ESLint on all changed application JS/TSX files.
- `tsc --noEmit`.
- `node tests/member-research.test.mjs`: state distinctions, missing/malformed availability, pending versus unavailable results, settled-first selection and analytics privacy.
- `node scripts/check-member-access.cjs`: safe auth redirects and admin fail-closed checks.
- `npm run test:positioning`: private positioning and retired public play routes.
- `git diff --check`.
- `npm run build` with an explicitly empty inherited environment and only local fake Supabase settings. The existing Next configuration skips lint during build; this was not changed.
- Agent-browser smoke verification: page loads, expected links/buttons render, screenshot, no framework error overlay.
- Playwright desktop (1440×1000) / mobile (390×844) verification against both dev and production-build local servers. External browser requests blocked; auth signup, member feed and event writes mocked. Tests cover homepage links, preview tabs/guide, logged-out redirect, required/invalid email/short password/no-interest validation, auth error, confirmation-required and immediate-session signup, member empty/explicit-no-qualifying/paused/stale/unavailable/error states, populated/pending/missing-result records, settled-first opening, optional feedback, Markets closed result with missing P&L, and event payloads. No page errors or viewport overflow found.

Repository-wide `npm run lint` remains failing with **52 errors and 3 warnings**, all in files unchanged from the base. Examples include `pages/api/odds-shop.ts`, `pages/api/picks.ts`, `lib/publicGrowth.ts`, and `components/SchemaForm.tsx`. Unrelated cleanup was deliberately left outside this task. Full log is in the review artifact directory.

The environment injects service credentials. The initial dev smoke check, before clearing the inherited environment, invoked the existing analytics endpoint and logged a failed fetch; no successful production write was observed. Subsequent browser-suite event requests were intercepted, and the final build/server verification used a cleared environment. No real signup or member-data mutation was submitted. Do not run these tests against production or with real credentials.

## Reproduce safely

From the repository, use separate terminals. Do not add production `.env` files:

```bash
node tests/mock-auth.cjs
```

```bash
env -i PATH="$PATH" HOME=/tmp NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4010 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-only NEXT_TELEMETRY_DISABLED=1 npm run build
env -i PATH="$PATH" HOME=/tmp NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4010 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test-only NEXT_TELEMETRY_DISABLED=1 npm start -- --hostname 127.0.0.1
```

Playwright is a temporary verification tool, not an added application dependency. This environment installed it with agent-browser and prettier under `/tmp/ss-browser`:

```bash
PLAYWRIGHT_MODULE=/tmp/ss-browser/node_modules/playwright REVIEW_DIR=/workspace/sharpssignal-review node tests/first-use.browser.cjs
```

The fixture binds only to loopback. Its signup responses and member records are synthetic; no test bypass exists in application code.

## Artifacts and limits

`/workspace/sharpssignal-review/` contains desktop/mobile PNGs, `browser-results.json`, build logs, full lint log and a review diff. Key screenshots: `home-desktop.png`, `home-mobile.png`, `preview-desktop.png`, `preview-mobile.png`, `signup-mobile.png`, `signup-validation-desktop.png`, `signup-confirmation-desktop.png`, `member-record-desktop.png`, `member-empty-mobile.png`, `member-error-mobile.png`, `member-stale-desktop.png`, `member-markets-mobile.png`.

Live email confirmation/delivery, actual analytics persistence and availability of published member records were not tested by making production submissions. Member feed authorization and publication remain controlled by the existing backend. The backend currently distinguishes publication emptiness from unavailable/stale data; “no qualifying signals” is only shown if explicitly returned, never inferred from an empty array. The support mailbox choice is resolved, but mailbox ownership/delivery was not independently tested.

Remaining approval: authorize publication of this exact reviewed local change—first pushing the branch, then separately approve the intended merge/deployment target and production deployment. Nothing is published by this implementation. Do not merge stale `main` over the current brand design.
