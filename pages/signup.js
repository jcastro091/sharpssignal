import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { buildAuthCallbackUrl, getSafeNext } from "../lib/authRedirect";

export default function SignUp() {
  const router = useRouter();
  const supabase = useMemo(() => createPagesBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const next = getSafeNext(router.query.next);

  useEffect(() => {
    let mounted = true;

    async function redirectIfSignedIn() {
      const { data } = await supabase.auth.getSession();
      if (mounted && data?.session) {
        router.replace(next);
      }
    }

    redirectIfSignedIn();

    return () => {
      mounted = false;
    };
  }, [next, router, supabase]);

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
      const emailRedirectTo = buildAuthCallbackUrl(window.location.origin, next);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        setErrorMsg(error.message || "Could not create your account.");
        return;
      }

      if (data?.session) {
        await router.replace(next);
        return;
      }

      setStatus("Check your email to confirm your account.");
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
          Create a password so you can sign in again later.
        </p>

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
