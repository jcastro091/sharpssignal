import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { buildAuthCallbackUrl, getSafeNext } from "../lib/authRedirect";
import { getFirstTouch } from "../lib/funnelClient";
import { trackMemberEvent } from "../lib/memberAnalytics";
export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [interests, setInterests] = useState(["sports"]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const next = getSafeNext(router.query.next);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) router.replace(next);
    });
  }, [next, router]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!interests.length) throw Error("Choose Sports, Markets, or both.");
      if (password.length < 8)
        throw Error("Use at least 8 characters for your password.");
      trackMemberEvent("signup_submit");
      const attribution = getFirstTouch();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(window.location.origin, next),
          data: {
            interests,
            utm_source: attribution.utm_source || null,
            utm_campaign: attribution.utm_campaign || null,
          },
        },
      });
      if (error) throw error;
      // A notification failure must never undo a successful account creation.
      if(data?.user?.id)void fetch('/api/notify-signup',{
        method:'POST',headers:{'content-type':'application/json'},keepalive:true,
        body:JSON.stringify({user_id:data.user.id,email:email.trim().toLowerCase()}),
      }).catch(()=>{});
      trackMemberEvent("signup_success", {
        location: "member_signup",
        email_confirmation_required: !data?.session,
      });
      if (data?.session) {
        await router.replace(next);
        return;
      }
      setDone(true);
      setMessage(
        "Confirm your email to open your free dashboard. Research and updates arrive after a minimum 30-minute delay. You can upgrade through Stripe and connect Telegram from your dashboard.",
      );
    } catch (e) {
      setError(e.message || "Could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <div className="auth-intro">
        <span className="eyebrow">YOUR SIGNAL STARTS HERE</span>
        <h1>
          A little more <br />
          <span>clarity.</span>
        </h1>
        <p>
          Create your free account, confirm your email, and open your dashboard.
          Browse research with a minimum 30-minute delay. Upgrade through Stripe
          whenever you’re ready for real-time access and Telegram alerts.
        </p>
        <div className="auth-note">
          Free account · Paper research · No card required
        </div>
      </div>
      <section className="auth-card">
        <h2>Create your account</h2>
        <p className="muted">
          Free access. No card required. Sports is selected to get you started;
          Markets is optional.
        </p>
        {done ? (
          <>
            <div className="success-message" role="status">
              {message}
            </div>
            <Link className="button-primary" href={next}>
              I confirmed my email — open my dashboard →
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">
              Password <small>At least 8 characters</small>
            </label>
            <div className="password-field">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <fieldset>
              <legend>I’m interested in</legend>
              <div className="interest-options">
                {["sports", "markets"].map((x) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      checked={interests.includes(x)}
                      onChange={() =>
                        setInterests(
                          interests.includes(x)
                            ? interests.filter((i) => i !== x)
                            : [...interests, x],
                        )
                      }
                    />
                    {x === "sports" ? "Sports" : "Markets"}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="small muted">
              We store your email and interests for your account. Registering
              does not activate email, SMS, or push play alerts.{" "}
              <Link href="/privacy">Privacy</Link>
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <button className="button-primary full-width" disabled={busy}>
              {busy ? "Creating account…" : "Create account ↗"}
            </button>
          </form>
        )}
        <p className="small">
          Already have an account? <Link href="/signin">Log in</Link>
        </p>
      </section>
    </main>
  );
}
