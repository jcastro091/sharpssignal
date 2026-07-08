import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { ArrowRight, CheckCircle2, Lock, Radio } from "lucide-react";
import { buildAuthCallbackUrl, getSafeNext } from "../lib/authRedirect";
import { appendAttributionToUrl, getFirstTouch, trackFunnelEvent } from "../lib/funnelClient";

const PRO_PLAN = "pro_telegram";
const BASE_CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER || "/subscribe";

export default function SignUp() {
  const router = useRouter();
  const supabase = useMemo(() => createPagesBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [signupComplete, setSignupComplete] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [firstTouch, setFirstTouch] = useState({});

  const next = getSafeNext(router.query.next);
  const checkoutUrl = useMemo(() => buildCheckoutUrl(BASE_CHECKOUT_URL, { email, next, firstTouch }), [email, next, firstTouch]);

  useEffect(() => {
    setFirstTouch(getFirstTouch());
  }, [router.asPath]);

  useEffect(() => {
    if (!signupComplete) return;
    trackFunnelEvent("plan_view", {
      email,
      location: "signup_success_plan_card",
      plan: PRO_PLAN,
      next,
    });
  }, [email, next, signupComplete]);

  useEffect(() => {
    let mounted = true;

    async function redirectIfSignedIn() {
      const { data } = await supabase.auth.getSession();
      if (mounted && data?.session && !signupComplete) {
        router.replace(next);
      }
    }

    redirectIfSignedIn();

    return () => {
      mounted = false;
    };
  }, [next, router, signupComplete, supabase]);

  const trackCheckout = (location) => {
    trackFunnelEvent("checkout_click", {
      email,
      location,
      plan: PRO_PLAN,
      checkout_url: checkoutUrl,
      next,
    });
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Use at least 8 characters for your password.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const firstTouch = getFirstTouch();
      await trackFunnelEvent("signup_submit", { email, location: "signup_form" });
      const emailRedirectTo = buildAuthCallbackUrl(window.location.origin, next);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            utm_source: firstTouch.utm_source || null,
            utm_medium: firstTouch.utm_medium || null,
            utm_campaign: firstTouch.utm_campaign || null,
            utm_term: firstTouch.utm_term || null,
            utm_content: firstTouch.utm_content || null,
            referral_code: firstTouch.referral_code || null,
            referrer: firstTouch.referrer || null,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || "Could not create your account.");
        return;
      }

      try {
        const leadResponse = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            sport_interest: "all",
            utm_source: firstTouch.utm_source || "",
            utm_medium: firstTouch.utm_medium || "",
            utm_campaign: firstTouch.utm_campaign || "",
            utm_content: firstTouch.utm_content || "",
            referral_code: firstTouch.referral_code || "",
            page_path: window.location.pathname,
            landing_page: window.location.href,
            referrer: firstTouch.referrer || document.referrer || "",
          }),
        });
        if (leadResponse.ok) {
          await trackFunnelEvent("lead_created", { email, location: "signup_form" });
        }
      } catch {}

      if (data?.session) {
        await trackFunnelEvent("signup_success", { email, immediate_session: true });
        setConfirmationRequired(false);
        setSignupComplete(true);
        setStatus("Account created. Upgrade now to receive realtime Telegram alerts, or continue to the dashboard.");
        return;
      }

      await trackFunnelEvent("signup_success", { email, email_confirmation_required: true });
      setConfirmationRequired(true);
      setSignupComplete(true);
      setStatus("Check your email to confirm your account. You can still choose Pro now and Stripe will preserve your checkout.");
    } catch (err) {
      setErrorMsg(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center">Create Account</h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          Create your login, then choose whether to unlock realtime Telegram alerts.
        </p>

        {!signupComplete ? (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm password</label>
              <input
                type="password"
                className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            {errorMsg && <div className="text-red-600 text-sm text-center">{errorMsg}</div>}
            {status && <div className="text-green-700 text-sm text-center">{status}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{confirmationRequired ? "Signup received" : "Account created"}</p>
                  <p className="mt-1 leading-6">{status}</p>
                </div>
              </div>
            </div>

            <div className="rounded border border-slate-950 bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-300" />
                <h3 className="text-lg font-semibold">Unlock realtime alerts</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Pro sends qualified plays to Telegram when they trigger. Stripe manages billing and cancellation.
              </p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-3xl font-bold">$20</span>
                <span className="pb-1 text-sm text-slate-300">/ month</span>
              </div>
              <a
                href={checkoutUrl}
                onClick={() => trackCheckout("signup_success_primary")}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Continue to Pro checkout
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Lock className="h-4 w-4" /> Payment unlocks Telegram access after Stripe verification.
              </p>
            </div>

            <Link
              href={next}
              onClick={() => trackFunnelEvent("signup_success", { email, location: "signup_dashboard_secondary", next })}
              className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Continue free to dashboard
            </Link>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center leading-5">
          No credit card required. Free to try. We never sell your email.
        </div>

        <p className="mt-4 text-sm text-center">
          Already have an account?{" "}
          <Link href={`/signin?next=${encodeURIComponent(next)}`} className="text-indigo-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

function buildCheckoutUrl(baseUrl, { email, next, firstTouch }) {
  if (!baseUrl) return "/subscribe";
  try {
    const url = new URL(baseUrl, typeof window === "undefined" ? "https://www.sharps-signal.com" : window.location.origin);
    if (email) {
      url.searchParams.set("prefilled_email", email);
      url.searchParams.set("client_reference_id", `signup_${safeReference(email)}`);
    }
    url.searchParams.set("plan", PRO_PLAN);
    url.searchParams.set("signup_handoff", "1");
    if (next) url.searchParams.set("next", next);
    return appendAttributionToUrl(url.toString(), { email, next, plan: PRO_PLAN, firstTouch });
  } catch {
    return baseUrl;
  }
}

function safeReference(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 120);
}
