import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { getSafeNext, buildAuthCallbackUrl } from "../lib/authRedirect";
import { withAuthTimeout, createAuthAttempt } from "../lib/authWait";
export default function Signin() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState("password"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [next, setNext] = useState("/dashboard");
  const [ready, setReady] = useState(false);
  const attempts = useRef(null);
  if (!attempts.current) attempts.current = createAuthAttempt();
  useEffect(() => {
    // Read the browser URL after hydration, including on static routes without a query.
    const destination = getSafeNext(
      new URLSearchParams(window.location.search).get("next"),
    );
    setNext(destination);
    setReady(true);
    const current = attempts.current.begin();
    withAuthTimeout(() => supabase.auth.getSession())
      .then(async ({ data, error }) => {
        if (!current()) return;
        if (error) throw error;
        if (data?.session) {
          const navigated = await withAuthTimeout(() =>
            router.replace(destination),
          );
          if (navigated === false)
            throw Error("Navigation did not finish. Please try again.");
        }
      })
      .catch((e) => {
        if (current())
          setError(
            e.message || "Unable to check your session. Please try again.",
          );
      });
    return () => attempts.current.invalidate();
  }, [router.asPath, router]);
  async function submit(e) {
    e.preventDefault();
    if (busy || !ready) return;
    const current = attempts.current.begin();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await withAuthTimeout(() =>
        mode === "link"
          ? supabase.auth.signInWithOtp({
              email: email.trim(),
              options: {
                shouldCreateUser: false,
                emailRedirectTo: buildAuthCallbackUrl(
                  window.location.origin,
                  next,
                ),
              },
            })
          : supabase.auth.signInWithPassword({ email: email.trim(), password }),
      );
      if (!current()) return;
      if (result.error) throw result.error;
      if (mode === "link")
        setMessage(
          "Check your inbox for a secure sign-in link. Open it in this browser to finish signing in.",
        );
      else {
        const navigated = await withAuthTimeout(() => router.replace(next));
        if (navigated === false)
          throw Error("Navigation did not finish. Please try again.");
      }
    } catch (e) {
      if (current())
        setError(e.message || "Unable to sign in. Please try again.");
    } finally {
      if (current()) setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <div className="auth-intro">
        <span className="eyebrow">WELCOME BACK</span>
        <h1>
          Back to
          <br />
          <span>your signal.</span>
        </h1>
        <p>Your plays, prices and results, right where you left them.</p>
      </div>
      <section className="auth-card">
        <h2>Log in to SharpsSignal</h2>
        <div className="segmented">
          {["password", "link"].map((x) => (
            <button
              key={x}
              disabled={busy}
              aria-pressed={mode === x}
              onClick={() => {
                setMode(x);
                setError("");
                setMessage("");
              }}
            >
              {x === "password" ? "Password" : "Email me a link"}
            </button>
          ))}
        </div>
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
          {mode === "password" && (
            <>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
          <button
            className="button-primary full-width"
            disabled={busy || !ready}
          >
            {busy
              ? "Please wait…"
              : mode === "password"
                ? "Log in ↗"
                : "Send secure sign-in link"}
          </button>
        </form>
        <div className="auth-links">
          <Link href="/reset-password">Forgot password?</Link>
          <Link href="/signup">Create account</Link>
        </div>
      </section>
    </main>
  );
}
