import { gaEvent } from "./ga";

const VISITOR_KEY = "ss_visitor_id";
const SESSION_KEY = "ss_session_id";
const UTM_KEY = "ss_first_touch";

function randomId(prefix) {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : null;
  if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function storageGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {}
}

export function getVisitorId() {
  if (typeof window === "undefined") return "";
  const existing = storageGet(window.localStorage, VISITOR_KEY);
  if (existing) return existing;
  const created = randomId("v");
  storageSet(window.localStorage, VISITOR_KEY, created);
  return created;
}

export function getSessionId() {
  if (typeof window === "undefined") return "";
  const existing = storageGet(window.sessionStorage, SESSION_KEY);
  if (existing) return existing;
  const created = randomId("s");
  storageSet(window.sessionStorage, SESSION_KEY, created);
  return created;
}

export function getFirstTouch() {
  if (typeof window === "undefined") return {};
  const currentTouch = currentAttribution();
  const existing = storageGet(window.localStorage, UTM_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      const merged = mergeAttribution(parsed, currentTouch);
      if (JSON.stringify(parsed) !== JSON.stringify(merged)) {
        storageSet(window.localStorage, UTM_KEY, JSON.stringify(merged));
      }
      return merged;
    } catch {}
  }

  storageSet(window.localStorage, UTM_KEY, JSON.stringify(currentTouch));
  return currentTouch;
}

function currentAttribution() {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";
  const inferred = inferSource(referrer);
  return {
    utm_source: params.get("utm_source") || inferred.utm_source || "",
    utm_medium: params.get("utm_medium") || inferred.utm_medium || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_term: params.get("utm_term") || "",
    utm_content: params.get("utm_content") || "",
    referral_code: params.get("referral_code") || params.get("ref") || "",
    referrer,
    first_path: window.location.pathname,
    first_url: window.location.href,
    captured_at: new Date().toISOString(),
  };
}

function inferSource(referrer) {
  const value = String(referrer || "").toLowerCase();
  if (!value) return { utm_source: "direct", utm_medium: "none" };
  if (value.includes("google.")) return { utm_source: "google", utm_medium: "organic" };
  if (value.includes("bing.")) return { utm_source: "bing", utm_medium: "organic" };
  if (value.includes("x.com") || value.includes("twitter.com")) return { utm_source: "x", utm_medium: "social" };
  if (value.includes("facebook.") || value.includes("instagram.")) return { utm_source: "meta", utm_medium: "social" };
  try {
    return { utm_source: new URL(referrer).hostname.replace(/^www\./, ""), utm_medium: "referral" };
  } catch {
    return { utm_source: "referral", utm_medium: "referral" };
  }
}

function mergeAttribution(existing, current) {
  const merged = { ...(existing || {}) };
  for (const field of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referral_code", "referrer"]) {
    if (!merged[field] && current[field]) merged[field] = current[field];
  }
  if (!merged.first_path) merged.first_path = current.first_path;
  if (!merged.first_url) merged.first_url = current.first_url;
  if (!merged.captured_at) merged.captured_at = current.captured_at;
  if (hasRealAttribution(current)) {
    merged.last_attributed_path = current.first_path;
    merged.last_attributed_url = current.first_url;
    merged.last_attributed_at = new Date().toISOString();
  }
  return merged;
}

function hasRealAttribution(value) {
  return Boolean(
    value?.utm_source ||
      value?.utm_medium ||
      value?.utm_campaign ||
      value?.utm_term ||
      value?.utm_content ||
      value?.referral_code ||
      value?.referrer
  );
}

export async function trackFunnelEvent(eventName, metadata = {}) {
  if (typeof window === "undefined" || !eventName) return;
  const firstTouch = getFirstTouch();
  const payload = {
    event_name: eventName,
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    email: metadata?.email || "",
    plan: metadata?.plan || "",
    checkout_url: metadata?.checkout_url || "",
    location: metadata?.location || "",
    page_path: window.location.pathname,
    page_url: window.location.href,
    referrer: firstTouch.referrer || document.referrer || "",
    utm_source: firstTouch.utm_source || "",
    utm_medium: firstTouch.utm_medium || "",
    utm_campaign: firstTouch.utm_campaign || "",
    utm_term: firstTouch.utm_term || "",
    utm_content: firstTouch.utm_content || "",
    referral_code: metadata?.referral_code || firstTouch.referral_code || "",
    landing_page: firstTouch.first_url || "",
    metadata,
  };

  gaEvent({
    action: eventName,
    category: "funnel",
    label: metadata?.label || payload.page_path,
    value: metadata?.value,
  });

  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

export function appendAttributionToUrl(baseUrl, metadata = {}) {
  if (!baseUrl) return "";
  const origin = typeof window === "undefined" ? "https://www.sharps-signal.com" : window.location.origin;
  try {
    const url = new URL(baseUrl, origin);
    const touch = metadata.firstTouch || (typeof window !== "undefined" ? getFirstTouch() : {});
    const fields = {
      utm_source: touch.utm_source || metadata.utm_source || "",
      utm_medium: touch.utm_medium || metadata.utm_medium || "",
      utm_campaign: touch.utm_campaign || metadata.utm_campaign || "",
      utm_term: touch.utm_term || metadata.utm_term || "",
      utm_content: touch.utm_content || metadata.utm_content || "",
      referral_code: metadata.referral_code || touch.referral_code || "",
      ref: metadata.ref || touch.referral_code || "",
      landing_page: touch.first_url || metadata.landing_page || "",
      first_path: touch.first_path || metadata.first_path || "",
      referrer: touch.referrer || metadata.referrer || "",
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value && !url.searchParams.get(key)) url.searchParams.set(key, value);
    }
    if (metadata.email && !url.searchParams.get("prefilled_email")) {
      url.searchParams.set("prefilled_email", metadata.email);
    }
    if (metadata.plan && !url.searchParams.get("plan")) {
      url.searchParams.set("plan", metadata.plan);
    }
    if (metadata.next && !url.searchParams.get("next")) {
      url.searchParams.set("next", metadata.next);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}
