import { useEffect } from "react";
import { useRouter } from "next/router";
import { trackFunnelEvent } from "../lib/funnelClient";

function eventNameForPath(path) {
  if (path === "/") return "landing_view";
  if (path.startsWith("/picks-preview")) return "picks_preview_view";
  if (path.startsWith("/record")) return "record_view";
  if (path.startsWith("/reports/weekly")) return "weekly_report_view";
  if (path.startsWith("/signup")) return "signup_view";
  if (path.startsWith("/subscribe")) return "subscribe_view";
  if (path.startsWith("/picks")) return "dashboard_view";
  return "page_view";
}

export default function FunnelTracker() {
  const router = useRouter();

  useEffect(() => {
    function track(url) {
      const path = String(url || window.location.pathname).split("?")[0];
      trackFunnelEvent(eventNameForPath(path), { path });
      if (path.startsWith("/picks-preview")) {
        trackFunnelEvent("signup_view", { path, location: "picks_preview" });
      }
    }

    track(router.asPath);
    router.events.on("routeChangeComplete", track);
    return () => router.events.off("routeChangeComplete", track);
  }, [router]);

  return null;
}
