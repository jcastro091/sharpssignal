import { useEffect, useState } from "react";
import Link from "next/link";
import { setAnalyticsConsent } from "../lib/analyticsConsent";
export default function AnalyticsConsent() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(
        !localStorage.getItem("ss_analytics_consent") &&
          !navigator.globalPrivacyControl &&
          navigator.doNotTrack !== "1",
      );
    } catch {}
    const show = () => setOpen(true);
    window.addEventListener("ss-privacy-settings", show);
    return () => window.removeEventListener("ss-privacy-settings", show);
  }, []);
  if (!open) return null;
  return (
    <aside className="analytics-consent" aria-label="Analytics choices">
      <p>
        Help us improve SharpsSignal? Optional analytics measure page visits,
        reading, clicks and signup steps. We don’t record your screen or form
        entries. <Link href="/privacy">Details</Link>
      </p>
      <div>
        <button
          className="button-primary"
          onClick={() => {
            setAnalyticsConsent(true);
            setOpen(false);
          }}
        >
          Allow analytics
        </button>
        <button
          className="button-secondary"
          onClick={() => {
            setAnalyticsConsent(false);
            setOpen(false);
          }}
        >
          No thanks
        </button>
      </div>
    </aside>
  );
}
