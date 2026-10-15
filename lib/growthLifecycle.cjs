const { token } = require("./measurement.cjs");
const DAY = 86400000;
const at = (value) => Date.parse(value || "");
const name = (event) => event.event_name || event.event_type;
const campaign = (value) => ({
  source: token(value?.utm_source) || "unattributed",
  medium: token(value?.utm_medium) || "(none)",
  campaign: token(value?.utm_campaign) || "(none)",
  content: token(value?.utm_content) || "(not tagged)",
});
const campaignKey = (value) => JSON.stringify(Object.values(campaign(value)));
function signupWeek(value) {
  // Signup cohorts use calendar weeks in the business timezone, including DST.
  const date = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value)) + "T00:00:00Z",
  );
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
function summarizeLifecycle(events, evidence = {}, options = {}) {
  const now = options.now ?? Date.now(),
    since = at(options.since) || now - 30 * DAY;
  const statuses = evidence.statuses || {};
  const available = (key) => statuses[key] === "available";
  const seen = new Set();
  const rows = events.filter((e) => {
    if (
      e.source !== "web" ||
      e.metadata?.test ||
      !Number.isFinite(at(e.created_at || e.event_at))
    )
      return false;
    const t = at(e.created_at || e.event_at);
    if (t < since || t > now || (e.event_id && seen.has(e.event_id)))
      return false;
    if (e.event_id) seen.add(e.event_id);
    return true;
  });
  const activityAvailable =
    statuses.activity !== "partial" && statuses.activity !== "unavailable";
  const count = (eventName) =>
    !activityAvailable
      ? null
      : new Set(
          rows
            .filter((e) => name(e) === eventName && e.visitor_id)
            .map((e) => e.visitor_id),
        ).size;
  const groups = new Map();
  function group(value) {
    const key = campaignKey(value);
    if (!groups.has(key))
      groups.set(key, {
        ...campaign(value),
        visitors: new Set(),
        accounts: new Set(),
        confirmed: new Set(),
        activated: new Set(),
        returning: new Set(),
        waitlist: 0,
      });
    return groups.get(key);
  }
  for (const e of rows)
    if (name(e) === "page_view" && e.visitor_id)
      group(e).visitors.add(e.visitor_id);
  const accounts = [
    ...new Map((evidence.accounts || []).map((a) => [a.id, a])).values(),
  ].filter(
    (a) => !a.qa_test && at(a.created_at) >= since && at(a.created_at) <= now,
  );
  const activity = new Map();
  for (const e of rows) {
    // Identity and record proof are stamped by the server, never accepted from browser metadata.
    if (
      name(e) !== "record_view" ||
      !e.user_id ||
      e.metadata?.authenticated_record !== "v1" ||
      !/^[a-f0-9]{64}$/.test(e.metadata?.record_key || "")
    )
      continue;
    if (!activity.has(e.user_id)) activity.set(e.user_id, []);
    activity.get(e.user_id).push(e);
  }
  const cohorts = new Map();
  let confirmed = 0,
    activated = 0,
    returning = 0,
    attributed = 0;
  for (const a of accounts) {
    const created = at(a.created_at),
      confirmation = at(a.email_confirmed_at);
    const isConfirmed =
      Number.isFinite(confirmation) &&
      confirmation >= created &&
      confirmation <= now;
    const actions = (activity.get(a.id) || [])
      .filter((e) => isConfirmed && at(e.created_at) >= confirmation)
      .sort((x, y) => at(x.created_at) - at(y.created_at));
    const first = actions[0];
    const repeat = actions.filter(
      (e) =>
        first &&
        at(e.created_at) >= at(first.created_at) + DAY &&
        e.metadata.record_key !== first.metadata.record_key,
    );
    const g = group(a.acquisition);
    g.accounts.add(a.id);
    if (a.acquisition?.visitor_id) attributed++;
    if (isConfirmed) {
      confirmed++;
      g.confirmed.add(a.id);
    }
    if (first) {
      activated++;
      g.activated.add(a.id);
    }
    if (repeat.length) {
      returning++;
      g.returning.add(a.id);
    }
    const week = signupWeek(a.created_at);
    if (!cohorts.has(week))
      cohorts.set(week, {
        week,
        signups: 0,
        measurable: 0,
        activated: 0,
        d7: { eligible: 0, returned: 0, pending: 0 },
        d30: { eligible: 0, returned: 0, pending: 0 },
      });
    const c = cohorts.get(week);
    c.signups++;
    // Historical accounts and consent-declined accounts lack a complete observation window.
    const measurable =
      a.acquisition?.version === "2026-10-15-v2" &&
      Boolean(a.acquisition?.visitor_id);
    if (!measurable) continue;
    c.measurable++;
    if (first) c.activated++;
    for (const [key, days] of [
      ["d7", 7],
      ["d30", 30],
    ]) {
      if (created + days * DAY > now) {
        c[key].pending++;
        continue;
      }
      c[key].eligible++;
      if (repeat.some((e) => at(e.created_at) <= created + days * DAY))
        c[key].returned++;
    }
  }
  const waitlist = (evidence.waitlist || []).filter(
    (w) => at(w.created_at) >= since && at(w.created_at) <= now,
  );
  for (const w of waitlist) group(w).waitlist++;
  const paid = (evidence.payments || []).filter(
    (p) =>
      p.livemode === true &&
      p.status === "complete" &&
      p.payment_status === "paid" &&
      p.amount_total > 0 &&
      p.metadata?.qa_test !== "true" &&
      p.metadata?.owner_verification !== "true" &&
      p.created * 1000 >= since &&
      p.created * 1000 <= now,
  );
  const uniquePaid = [...new Map(paid.map((p) => [p.id, p])).values()];
  const subscriptions = uniquePaid.filter(
    (p) => p.mode === "subscription" && p.metadata?.plan === "pro_telegram",
  );
  const picks = uniquePaid.filter(
    (p) => p.mode === "payment" && p.metadata?.product_type === "pick",
  );
  const step = (label, value, unit) => ({ label, value, unit });
  const accountCount = (value) => (available("accounts") ? value : null);
  return {
    statuses,
    conversions: {
      submitted: count("signup_submit"),
      created: accountCount(accounts.length),
      confirmed: accountCount(confirmed),
      activated: activityAvailable ? accountCount(activated) : null,
      returning: activityAvailable ? accountCount(returning) : null,
      attributed: accountCount(attributed),
    },
    campaigns: [...groups.values()]
      .map((g) => ({
        source: g.source,
        medium: g.medium,
        campaign: g.campaign,
        content: g.content,
        visitors: activityAvailable ? g.visitors.size : null,
        created: accountCount(g.accounts.size),
        confirmed: accountCount(g.confirmed.size),
        activated: activityAvailable ? accountCount(g.activated.size) : null,
        returning: activityAvailable ? accountCount(g.returning.size) : null,
        waitlist: available("waitlist") ? g.waitlist : null,
      }))
      .sort((a, b) => b.visitors - a.visitors),
    cohorts:
      available("accounts") && activityAvailable
        ? [...cohorts.values()].sort((a, b) => b.week.localeCompare(a.week))
        : null,
    offers: [
      {
        key: "membership",
        title: "Free membership",
        status: statuses.accounts,
        steps: [
          step("Signup page visitors", count("signup_view"), "browsers"),
          step("Signup submitted", count("signup_submit"), "browsers"),
          step("Account created", accountCount(accounts.length), "accounts"),
          step("Email confirmed", accountCount(confirmed), "accounts"),
          step(
            "First released record viewed",
            activityAvailable ? accountCount(activated) : null,
            "accounts",
          ),
        ],
      },
      {
        key: "free_play_email",
        title: "Free-play email signup",
        status: "not_configured",
        steps: [],
        note: "No dedicated free-play email signup or double-opt-in flow exists. Account registration and the $5 waitlist do not subscribe people to it.",
      },
      {
        key: "subscription",
        title: "Paid subscription",
        status: statuses.payments,
        note: "Initial live paid checkouts, not active subscribers, renewals or net revenue. Later refunds do not erase the original checkout.",
        steps: [
          step("Plan viewed", count("plan_view"), "browsers"),
          step("Checkout clicked", count("checkout_click"), "browsers"),
          step(
            "Verified paid checkout",
            available("payments") ? subscriptions.length : null,
            "checkouts",
          ),
        ],
      },
      {
        key: "pick_interest",
        title: "$5-pick interest",
        status: statuses.waitlist,
        steps: [
          step("Waitlist seen", count("pick_waitlist_view"), "browsers"),
          step("Waitlist submitted", count("pick_waitlist_submit"), "browsers"),
          step(
            "Unique saved waitlist entries",
            available("waitlist") ? waitlist.length : null,
            "entries",
          ),
        ],
        note: "Saved interest only; email ownership is unverified. This is not an account or a purchase.",
      },
      {
        key: "pick_purchase",
        title: "Individual-pick purchase",
        status: statuses.payments,
        steps: [
          step("Shop viewed", count("pick_shop_view"), "browsers"),
          step("Checkout clicked", count("pick_checkout_click"), "browsers"),
          step(
            "Verified paid checkout",
            available("payments") ? picks.length : null,
            "checkouts",
          ),
        ],
        note: "Initial successful payments, including subsequently refunded payments; not net revenue or current access.",
      },
    ],
  };
}
module.exports = { summarizeLifecycle, signupWeek };
