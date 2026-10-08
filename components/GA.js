import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/router";
import { analyticsAllowed, analyticsTest } from "../lib/analyticsConsent";
const { PRIVATE_PATHS, safeUrl } = require("../lib/measurement.cjs");
const ID =
  process.env.NEXT_PUBLIC_GA4_ID ||
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  "G-1YRZ2NHRZ0";
export default function GA() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const sync = () => {
      const allow =
        analyticsAllowed() &&
        !analyticsTest() &&
        !PRIVATE_PATHS.test(location.pathname);
      window["ga-disable-" + ID] = !allow;
      setEnabled(allow);
      if (allow) {
        window.dataLayer = window.dataLayer || [];
        window.gtag =
          window.gtag ||
          function () {
            window.dataLayer.push(arguments);
          };
        window.gtag("js", new Date());
        window.gtag("config", ID, {
          send_page_view: false,
          page_location: safeUrl(location.href),
          page_referrer: safeUrl(document.referrer),
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
      }
    };
    sync();
    window.addEventListener("ss-consent", sync);
    const stop = () => {
      window["ga-disable-" + ID] = true;
    };
    router.events.on("routeChangeStart", stop);
    router.events.on("routeChangeComplete", sync);
    return () => {
      window.removeEventListener("ss-consent", sync);
      router.events.off("routeChangeStart", stop);
      router.events.off("routeChangeComplete", sync);
    };
  }, [router.events]);
  return enabled ? (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${ID}`}
      strategy="afterInteractive"
    />
  ) : null;
}
