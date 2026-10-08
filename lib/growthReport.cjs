const { safePath } = require("./measurement.cjs");
const STAGES = [
  "page_view",
  "signup_click",
  "signup_view",
  "signup_success",
  "plan_view",
  "checkout_click",
];
function summarize(events, payments = [], options = {}) {
  const rows = events.filter(
    (e) =>
      e.source === "web" &&
      e.metadata?.revision === "2026-10-08-v1" &&
      !e.metadata?.test,
  );
  const byVisitor = new Map(),
    pages = new Map(),
    sources = new Map();
  const heat = [],
    targets = new Map();
  for (const e of rows) {
    const name = e.event_name || e.event_type,
      path = safePath(e.page_path),
      id = e.visitor_id;
    if (id) {
      if (!byVisitor.has(id)) byVisitor.set(id, []);
      byVisitor.get(id).push(e);
    }
    if (!pages.has(path))
      pages.set(path, {
        path,
        views: 0,
        visitors: new Set(),
        engaged: new Set(),
        depths: { 25: new Set(), 50: new Set(), 75: new Set(), 90: new Set() },
      });
    const p = pages.get(path);
    if (name === "page_view") {
      p.views++;
      if (id) p.visitors.add(id);
      const source = [
        e.utm_source || "direct",
        e.utm_campaign || "(none)",
      ].join(" / ");
      if (!sources.has(source)) sources.set(source, new Set());
      if (id) sources.get(source).add(id);
    }
    if (name === "page_engaged" && id) p.engaged.add(id);
    if (name === "scroll_depth" && id) p.depths[e.metadata.depth]?.add(id);
    if (name === "site_click") {
      const key = path + " · " + (e.metadata?.target || "page");
      targets.set(key, (targets.get(key) || 0) + 1);
      if (Number.isFinite(e.metadata?.x) && Number.isFinite(e.metadata?.y))
        heat.push({
          path,
          device: e.metadata.device,
          x: e.metadata.x,
          y: e.metadata.y,
        });
    }
  }
  const totals = STAGES.map(() => 0),
    completed = new Map(),
    articleReaders = new Set(),
    articleEngaged = new Set(),
    articleSignups = new Set();
  const time = (e) => Date.parse(e.event_at || e.created_at || 0);
  for (const [id, list] of byVisitor) {
    list.sort((a, b) => time(a) - time(b));
    let stage = 0,
      completedAt = null,
      readAt = null;
    for (const e of list) {
      const name = e.event_name || e.event_type;
      if (name === STAGES[stage]) {
        totals[stage]++;
        stage++;
        if (stage === STAGES.length) completedAt = time(e);
      }
      if (name === "article_view") {
        articleReaders.add(id);
        readAt = time(e);
      }
      if (name === "article_engaged") articleEngaged.add(id);
      if (name === "signup_success" && readAt !== null && time(e) >= readAt)
        articleSignups.add(id);
    }
    if (stage === STAGES.length) completed.set(id, completedAt);
  }
  const paid = payments.filter(
    (p) =>
      p.livemode === true &&
      p.mode === "subscription" &&
      p.status === "complete" &&
      p.payment_status === "paid" &&
      p.amount_total > 0 &&
      p.metadata?.plan === "pro_telegram" &&
      p.metadata?.qa_test !== "true",
  );
  const attributed = new Set(
    paid
      .filter(
        (p) =>
          completed.has(p.metadata?.visitor_id) &&
          p.created * 1000 >= completed.get(p.metadata.visitor_id) - 1000,
      )
      .map((p) => p.metadata.visitor_id),
  );
  const clientCounts = {};
  for (const e of rows) {
    const name = e.event_name || e.event_type;
    clientCounts[name] = (clientCounts[name] || 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    ...options,
    events: rows.length,
    visitors: byVisitor.size,
    funnel: STAGES.map((name, i) => ({ name, visitors: totals[i] })).concat({
      name: "paid_checkout_verified",
      visitors: options.payments_available === false ? null : attributed.size,
    }),
    payments:
      options.payments_available === false
        ? null
        : {
            completed_checkouts: paid.length,
            attributed_funnel_visitors: attributed.size,
            unattributed_checkouts: paid.filter(
              (p) => !byVisitor.has(p.metadata?.visitor_id),
            ).length,
          },
    article: {
      readers: articleReaders.size,
      engaged: articleEngaged.size,
      subsequent_signups: articleSignups.size,
    },
    pages: [...pages.values()]
      .map((p) => ({
        ...p,
        visitors: p.visitors.size,
        engaged: p.engaged.size,
        depths: Object.fromEntries(
          Object.entries(p.depths).map(([k, v]) => [k, v.size]),
        ),
      }))
      .sort((a, b) => b.views - a.views),
    sources: [...sources]
      .map(([source, ids]) => ({ source, visitors: ids.size }))
      .sort((a, b) => b.visitors - a.visitors),
    targets: [...targets]
      .map(([target, clicks]) => ({ target, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 30),
    heat,
    clientCounts,
  };
}
module.exports = { summarize, STAGES };
