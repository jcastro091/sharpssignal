export function analyticsTest() {
  if (typeof window === "undefined") return false;
  try {
    if (
      location.hostname === "localhost" ||
      new URLSearchParams(location.search).get("analytics_test") === "1"
    )
      sessionStorage.setItem("ss_analytics_test", "true");
    return sessionStorage.getItem("ss_analytics_test") === "true";
  } catch {
    return false;
  }
}
export function analyticsAllowed() {
  if (typeof window === "undefined") return false;
  try {
    return (
      !navigator.globalPrivacyControl &&
      navigator.doNotTrack !== "1" &&
      localStorage.getItem("ss_analytics_consent") === "yes"
    );
  } catch {
    return false;
  }
}
export function setAnalyticsConsent(allowed) {
  try {
    localStorage.setItem("ss_analytics_consent", allowed ? "yes" : "no");
    if (!allowed) {
      ["ss_visitor_id", "ss_first_touch"].forEach((k) =>
        localStorage.removeItem(k),
      );
      sessionStorage.removeItem("ss_session_id");
    }
  } catch {}
  window.dispatchEvent(new Event("ss-consent"));
}
