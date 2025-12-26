// pages/signup.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export default function SignUp() {
  const router = useRouter();
  const supabase = useMemo(() => createPagesBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // If they are already logged in, go to picks
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data?.session) {
        router.replace("/picks");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      if (typeof window === "undefined") {
        setStatus("This page must run in the browser.");
        return;
      }

      // Build a safe redirect URL
      const emailRedirectTo = new URL("/auth/callback", window.location.origin);
      // Use "picks" (no leading slash) to avoid double-encoding issues in query params
      emailRedirectTo.searchParams.set("next", "/picks");


      console.log("[signup] origin =", window.location.origin);
      console.log("[signup] emailRedirectTo =", emailRedirectTo.toString());

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: emailRedirectTo.toString(),
        },
      });

      if (error) {
        console.error("[signup] supabase error full:", JSON.stringify(error, null, 2));
        setStatus(error.message || "Error sending confirmation email");
        return;
      }

      console.log("[signup] signInWithOtp ok:", data);
      setStatus("✅ Check your email for a login link…");
    } catch (err) {
      console.error("[signup] unexpected error:", err);
      setStatus("Something went wrong. Check console/network logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div
          style={{
            width: 420,
            background: "#fff",
            padding: 28,
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>Create Account</h2>
          <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            We’ll send you a one-time magic link.
          </p>

          <form onSubmit={handleMagicLink}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              required
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                border: "none",
                background: "#4f46e5",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loading ? "Sending link…" : "Send Magic Link"}
            </button>
			<div
			  style={{
				marginTop: 12,
				fontSize: 12,
				color: "#6b7280",
				textAlign: "center",
				lineHeight: 1.5,
			  }}
			>
			  No credit card required • Free to try • Cancel anytime
			  <br />
			  We never spam or sell your email.
			</div>
			
			
			
			
			
          </form>

          {status && (
            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: status.startsWith("✅") ? "#16a34a" : "#b91c1c",
              }}
            >
              {status}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 13 }}>
            Already have an account?{" "}
            <a href="/signin" style={{ color: "#4f46e5", fontWeight: 700 }}>
              Sign In
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
