// Use the existing first-party event endpoint with fixed, non-personal fields.
// Deliberately omit attribution, identity, full URLs, referrers and record IDs.
const allowed = new Set([
  "signup_view",
  "signup_click",
  "signup_submit",
  "signup_success",
  "dashboard_view",
  "record_view",
  "member_guide_open",
  "member_feedback",
]);
export function trackMemberEvent(event, metadata = {}) {
  if (typeof window === "undefined" || !allowed.has(event)) return;
  const safe = {};
  if (["sports", "markets"].includes(metadata.section))
    safe.section = metadata.section;
  if (["yes", "not_yet"].includes(metadata.answer))
    safe.answer = metadata.answer;
  if (typeof metadata.email_confirmation_required === "boolean")
    safe.email_confirmation_required = metadata.email_confirmation_required;
  return fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event_name: event,
      location: "member_first_use",
      metadata: safe,
    }),
  }).catch(() => {});
}
