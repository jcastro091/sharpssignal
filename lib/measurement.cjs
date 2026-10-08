const PUBLIC_EVENTS = new Set([
  "page_view",
  "landing_view",
  "picks_preview_view",
  "record_view",
  "weekly_report_view",
  "signup_view",
  "subscribe_view",
  "dashboard_view",
  "plan_view",
  "signup_click",
  "signup_submit",
  "signup_success",
  "checkout_click",
  "checkout_error",
  "checkout_abandoned",
  "telegram_join_click",
  "support_contact",
  "member_guide_open",
  "member_feedback",
  "article_view",
  "article_engaged",
  "scroll_depth",
  "site_click",
  "page_engaged",
  "client_error",
]);
const PRIVATE_PATHS =
  /^\/(admin|analytics|ceo-dashboard|auth|reset-password|update-password|signin)(\/|$)/;
function safePath(value) {
  try {
    const path = new URL(String(value || "/"), "https://www.sharps-signal.com")
      .pathname;
    return /^\/[a-z0-9/_-]*$/i.test(path) ? path.slice(0, 180) : "/other";
  } catch {
    return "/other";
  }
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) ? u.origin + safePath(u.pathname) : "";
  } catch {
    return "";
  }
}
function token(value, max = 100) {
  return /^[a-z0-9_.:/ -]+$/i.test(String(value || ""))
    ? String(value).slice(0, max)
    : "";
}
function cleanEvent(body = {}) {
  const name = body.event_name;
  if (!PUBLIC_EVENTS.has(name)) return null;
  const path = safePath(body.page_path);
  if (PRIVATE_PATHS.test(path)) return null;
  const metadata = {};
  const m = body.metadata || {};
  for (const k of [
    "target",
    "destination",
    "article",
    "section",
    "answer",
    "device",
    "revision",
    "location",
  ])
    if (m[k]) metadata[k] = token(m[k], 180);
  for (const k of [
    "x",
    "y",
    "depth",
    "seconds",
    "viewport_width",
    "document_height",
  ])
    if (Number.isFinite(m[k]))
      metadata[k] = Math.max(0, Math.min(100000, Math.round(m[k])));
  if (
    m.test === true ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(String(body.page_url))
  )
    metadata.test = true;
  const occurred = Date.parse(body.event_at);
  return {
    event_at:
      Number.isFinite(occurred) && Math.abs(Date.now() - occurred) < 300000
        ? new Date(occurred).toISOString()
        : new Date().toISOString(),
    event_name: name,
    event_type: name,
    event_id: /^evt_[a-z0-9_-]{10,100}$/i.test(body.event_id || "")
      ? body.event_id
      : undefined,
    visitor_id: /^v_[a-z0-9_-]{10,100}$/i.test(body.visitor_id || "")
      ? body.visitor_id
      : null,
    session_id: /^s_[a-z0-9_-]{10,100}$/i.test(body.session_id || "")
      ? body.session_id
      : null,
    source: "web",
    page_path: path,
    page_url: safeUrl(body.page_url),
    landing_page: safeUrl(body.landing_page),
    referrer: safeUrl(body.referrer),
    utm_source: token(body.utm_source),
    utm_medium: token(body.utm_medium),
    utm_campaign: token(body.utm_campaign),
    utm_content: token(body.utm_content),
    metadata,
  };
}
module.exports = {
  PUBLIC_EVENTS,
  PRIVATE_PATHS,
  safePath,
  safeUrl,
  token,
  cleanEvent,
};
