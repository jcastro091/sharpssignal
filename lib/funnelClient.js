import { gaEvent } from "./ga";
import growth from "./growthRules.cjs";

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
    referrer: growth.cleanUrl(referrer),
    first_path: window.location.pathname,
    first_url: growth.cleanUrl(window.location.href),
    captured_at: new Date().toISOString(),
  };
}

function inferSource(referrer) { return growth.inferSource(referrer, window.location.origin); }
function mergeAttribution(existing, current) { return growth.mergeTouch(existing, current); }

export async function trackFunnelEvent(eventName, metadata = {}) {
  if (typeof window === "undefined" || !eventName || growth.internalPath(window.location.pathname)) return;
  const firstTouch = getFirstTouch();
  const payload = {
    event_name: eventName,
    event_id: metadata.event_id || randomId("event"),
    event_at: new Date().toISOString(),
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    email: metadata?.email || "",
    plan: metadata?.plan || "",
    checkout_url: metadata?.checkout_url || "",
    location: metadata?.location || "",
    page_path: window.location.pathname,
    page_url: growth.cleanUrl(window.location.href),
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
    parameters: {event_id: payload.event_id, location:payload.location, plan:payload.plan, utm_source:payload.utm_source,utm_medium:payload.utm_medium,utm_campaign:payload.utm_campaign,utm_content:payload.utm_content},
  });

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return response.ok ? await response.json() : {ok:false};
  } catch { return {ok:false}; }
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
