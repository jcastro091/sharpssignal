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
  const existing = storageGet(window.localStorage, UTM_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {}
  }

  const params = new URLSearchParams(window.location.search);
  const firstTouch = {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_term: params.get("utm_term") || "",
    utm_content: params.get("utm_content") || "",
    referrer: document.referrer || "",
    first_path: window.location.pathname,
    first_url: window.location.href,
    captured_at: new Date().toISOString(),
  };
  storageSet(window.localStorage, UTM_KEY, JSON.stringify(firstTouch));
  return firstTouch;
}

export async function trackFunnelEvent(eventName, metadata = {}) {
  if (typeof window === "undefined" || !eventName) return;
  const firstTouch = getFirstTouch();
  const payload = {
    event_name: eventName,
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    page_path: window.location.pathname,
    page_url: window.location.href,
    referrer: firstTouch.referrer || document.referrer || "",
    utm_source: firstTouch.utm_source || "",
    utm_medium: firstTouch.utm_medium || "",
    utm_campaign: firstTouch.utm_campaign || "",
    utm_term: firstTouch.utm_term || "",
    utm_content: firstTouch.utm_content || "",
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
