import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { buildAuthCallbackUrl, getSafeNext } from "../lib/authRedirect";

export default function SignInPage() {
  const router = useRouter();
  const supabase = useMemo(() => createPagesBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [status, setStatus] = useState("");

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

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setStatus("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (!data?.session) {
        setErrorMsg("Sign in succeeded, but no session was returned. Try again.");
        return;
      }

      await router.replace(next);
    } catch (err) {
      setErrorMsg(err?.message || "Could not sign in. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setMagicLoading(true);
    setErrorMsg("");
    setStatus("");

    try {
      const emailRedirectTo = buildAuthCallbackUrl(window.location.origin, next);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setStatus("Check your email for a sign-in link.");
    } catch (err) {
      setErrorMsg(err?.message || "Could not send sign-in link. Try again.");
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Welcome Back</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading || magicLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading || magicLoading}
            />
          </div>

          {errorMsg && <div className="text-red-600 text-sm text-center">{errorMsg}</div>}
          {status && <div className="text-green-700 text-sm text-center">{status}</div>}

          <button
            type="submit"
            disabled={loading || magicLoading}
            className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={!email || loading || magicLoading}
          className="mt-3 w-full border border-indigo-200 text-indigo-700 py-2 rounded font-semibold hover:bg-indigo-50 transition disabled:opacity-60"
        >
          {magicLoading ? "Sending link..." : "Email me a sign-in link"}
        </button>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/reset-password" className="text-indigo-600 hover:underline">
            Forgot password?
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-indigo-600 hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
