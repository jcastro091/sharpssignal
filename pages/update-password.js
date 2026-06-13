import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export default function UpdatePassword() {
  const router = useRouter();
  const supabase = useMemo(() => createPagesBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setErrorMsg(error.message);
      } else if (!data?.session) {
        setErrorMsg("Open the password reset link from your email before setting a new password.");
      }

      setCheckingSession(false);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleUpdate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setMessage("");

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
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setMessage("Your password has been updated.");
      setTimeout(() => router.replace("/signin"), 1500);
    } catch (err) {
      setErrorMsg(err?.message || "Could not update your password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Choose a new password</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Enter a new password for your SharpSignal account.
        </p>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <input
              type="password"
              className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              disabled={loading || checkingSession}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
            <input
              type="password"
              className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              disabled={loading || checkingSession}
            />
          </div>

          {errorMsg && <div className="text-red-600 text-sm text-center">{errorMsg}</div>}
          {message && <div className="text-green-700 text-sm text-center">{message}</div>}

          <button
            type="submit"
            disabled={loading || checkingSession}
            className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Updating..." : checkingSession ? "Checking link..." : "Update password"}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          <Link href="/reset-password" className="text-indigo-600 hover:underline">
            Request a new reset link
          </Link>
        </p>
      </div>
    </div>
  );
}
