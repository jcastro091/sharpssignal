# Completion tracking and mobile sports repair

New free sports journey: / → /signup?next=%2Fsports&interest=sports → email confirmation → /sports. Existing users can sign in to /sports. Feed access remains verified-email and interest controlled by the existing backend. Cards display recorded selections, decimal prices, Eastern game times in en-US format, and paper results; empty, delayed and error states are explicit.

Signup submission, account creation, awaiting confirmation and confirmed signup are separate events. Only authenticated confirmed users with the new signup metadata version produce signup_completed; retries share a stable user-derived ID. Existing accounts are not retrospectively counted. First campaign attribution is frozen into signup metadata and Stripe metadata. Preview visits remain picks_preview_view. Admin/auth/API routes are excluded from acquisition page events. URLs sent to GA remove email, session IDs and auth fragments.

Paid completion requires Stripe status complete and payment_status paid. Verification and signed webhook use the same Stripe-session event ID; async payment success is handled. Public browser event collection rejects payment/completed-signup claims. Storage failures return failure responses, and webhook persistence failures retry. GA uses recommended sign_up and purchase events and includes transaction ID, value and currency. Supabase is the durable conversion record.

## Validation

Next.js production build passed. 14 JavaScript regression checks passed for campaign attribution, false signup/payment prevention, durable event IDs, errors and shared webhook/verification completion IDs. Mobile browser checks passed at 375, 390 and 768 pixels: no overflow, Sports default selection, preserved campaign across navigation, preview semantic event and zero page errors. External GA and collector responses were mocked for browser checks; no real signup email or charge was sent. Backend ingestion and daily reporting have a companion change in the sports repository.

## Release limitation

Production is unchanged. Vercel deployment creation returned 403 forbidden for team_ko98S44j3huWWUMd2exN2Jh3 (jcastro091s-projects); no independent CLI credential is configured. The branded branch matches the live landing/signup/tracker/API source, but the current CLI deployment dpl_CadXsBnUkHcWnyp96z1LVTMSADtt contains newer dashboard, auth, notification and publishing files absent from this branch. Apply this repair as a patch to the complete live source. Do not replace production with the entire older checkout.

Before production release, preserve all live source files, deploy and inspect a preview using the complete source, verify Supabase unique event_id/upsert compatibility, and then verify confirmed signup and Stripe test-mode payment through persisted records. No production conversion persistence was verified in this environment.
