import { useMemo, useState } from "react";
import Link from "next/link";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { buildAuthCallbackUrl } from "../lib/authRedirect";

export default function ResetPassword() {
  const supabase = useMemo(() => createPagesBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setMessage("");

    try {
      const redirectTo = buildAuthCallbackUrl(window.location.origin, "/update-password");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setMessage("Check your email for a reset link.");
    } catch (err) {
      setErrorMsg(err?.message || "Could not send reset link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Reset your password</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          We will email you a secure link to choose a new password.
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring focus:border-blue-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          {errorMsg && <div className="text-red-600 text-sm text-center">{errorMsg}</div>}
          {message && <div className="text-green-700 text-sm text-center">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          <Link href="/signin" className="text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
