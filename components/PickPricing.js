import Link from "next/link";
import { useState } from "react";
export default function PickPricing() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  async function join(event) {
    event.preventDefault();
    if (status === "saving") return;
    const form = new FormData(event.currentTarget);
    setStatus("saving");
    setError("");
    try {
      const query = new URLSearchParams(window.location.search);
      const response = await fetch("/api/pick-waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"), consent: form.get("consent") === "on",
          website: form.get("website"), page_path: window.location.pathname,
          ...Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].map(key => [key, query.get(key)])),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Please try again.");
      setStatus("saved");
    } catch (err) {
      setStatus("idle");
      setError(err.message === "Failed to fetch" ? "Connection interrupted. Please try again." : err.message);
    }
  }
  return (
    <section id="pick-waitlist" className="feature-section" aria-labelledby="pick-pricing-title">
      <span className="eyebrow">INTEREST WAITLIST · NOT AVAILABLE TO BUY</span>
      <h2 id="pick-pricing-title">Interested in $5 per pick?</h2>
      <p>We’re working on an option to buy individual sports picks. Join the waitlist
        for updates as we build it. The proposed price is $5 per pick.</p>
      <p>No payment. No commitment. We’ll share final pricing and pick-fee refund
        terms before asking you to buy. Winning outcomes and wagering returns are never guaranteed.</p>
      {status === "saved" ? <p role="status">You’re on the waitlist. Your email is saved for $5-per-pick availability updates.</p> : (
        <form onSubmit={join} className="mt-6 flex max-w-lg flex-col gap-4">
          <label htmlFor="pick-waitlist-email">Email address</label>
          <input id="pick-waitlist-email" name="email" type="email" autoComplete="email" required maxLength={254}
            className="rounded border border-slate-400 bg-white p-3 text-slate-950" />
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
            <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <label className="flex items-start gap-3">
            <input name="consent" type="checkbox" required className="mt-1" />
            <span>Email me about the proposed $5-per-pick service and its availability.
              This does not subscribe me to the weekly newsletter. I can opt out by contacting SharpsSignal@gmail.com.</span>
          </label>
          <button type="submit" className="button-secondary" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Join the waitlist"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      <p className="muted mt-4"><Link href="/privacy">Privacy</Link> · <Link href="/legal#pick-refunds">Pick-fee refund terms</Link></p>
    </section>
  );
}
