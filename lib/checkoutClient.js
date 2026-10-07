import { getFirstTouch, getSessionId, getVisitorId, trackFunnelEvent } from "./funnelClient";

export async function startTrackedCheckout({
  email = "",
  location = "",
  next = "/picks",
  plan = "pro_telegram",
  fallbackUrl = "",
} = {}) {
  if (typeof window === "undefined") return false;

  const firstTouch = getFirstTouch();
  const payload = {
    ...firstTouch,
    email,
    location,
    next,
    plan,
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    landing_page: firstTouch.first_url || window.location.href,
    first_path: firstTouch.first_path || window.location.pathname,
    client_reference_id: email ? `signup_${safeReference(email)}` : getVisitorId(),
  };

  await trackFunnelEvent("checkout_click", {
    email,
    location,
    plan,
    checkout_url: fallbackUrl,
    next,
  });

  let recoveryUrl = fallbackUrl;
  try {
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    recoveryUrl = body?.fallback_url || fallbackUrl;
    const target = body?.url;
    if (response.ok && body?.ok && body?.url) {
      await trackFunnelEvent("begin_checkout", {plan,location});
      window.location.assign(target);
      return true;
    }
  } catch {}
  await trackFunnelEvent("checkout_create_failed", {plan,location});

  if (recoveryUrl) {
    window.location.assign(recoveryUrl);
    return true;
  }
  return false;
}

function safeReference(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 120);
}
