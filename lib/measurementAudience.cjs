// Only server-verified account facts classify traffic. User-editable metadata is never trusted.
const values = value => String(value || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
function audienceForUser(user, env = process.env) {
  if (!user?.email_confirmed_at) return "anonymous";
  const email = String(user.email || "").toLowerCase();
  const ids = values(env.ANALYTICS_EXCLUDED_USER_IDS);
  const emails = values([env.CEO_DASHBOARD_EMAILS, env.ADMIN_EMAIL, env.ANALYTICS_EXCLUDED_EMAILS, "SharpsSignal@gmail.com,jcastro091@gmail.com"].filter(Boolean).join(","));
  if (ids.includes(String(user.id).toLowerCase()) || emails.includes(email)) return "owner";
  if (user.id === env.QA_CHECKOUT_USER_ID || user.app_metadata?.qa_test === true || /@example\.invalid$/.test(email)) return "test";
  return "customer";
}
function excludedEvent(e) { return Boolean(e.metadata?.test || ["owner", "test"].includes(e.metadata?.audience)); }
function customerEvents(events, excludedIds = []) {
  const ids = new Set(excludedIds), visitors = new Set(), sessions = new Set();
  for (const e of events) if (excludedEvent(e) || ids.has(e.user_id)) {
    if (e.visitor_id) visitors.add(e.visitor_id);
    if (e.session_id) sessions.add(e.session_id);
  }
  return events.filter(e => !excludedEvent(e) && !ids.has(e.user_id) && !visitors.has(e.visitor_id) && !sessions.has(e.session_id));
}
module.exports = {audienceForUser, customerEvents};
