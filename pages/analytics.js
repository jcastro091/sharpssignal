import Head from "next/head";
import { useEffect, useState } from "react";
import { requireCeoPageAccess } from "../lib/ceoAccess";
export async function getServerSideProps({ req, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  const a = await requireCeoPageAccess(req, res);
  if (!a.allowed)
    return {
      redirect: { destination: a.redirect || "/dashboard", permanent: false },
    };
  return { props: {} };
}
export default function Analytics() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [days, setDays] = useState(30),
    [path, setPath] = useState("/blog/why-we-passed-marlins-diamondbacks"),
    [device, setDevice] = useState("mobile");
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    fetch("/api/growth-analytics?days=" + days)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Analytics unavailable");
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [days]);
  const points =
    data?.heat.filter((p) => p.path === path && p.device === device) || [];
  const bins = Array.from({ length: 100 }, () => 0);
  points.forEach(
    (p) =>
      bins[
        Math.min(9, Math.floor(p.y / 10)) * 10 +
          Math.min(9, Math.floor(p.x / 10))
      ]++,
  );
  const max = Math.max(1, ...bins);
  const page = data?.pages.find((p) => p.path === path);
  return (
    <>
      <Head>
        <title>Website analytics | SharpsSignal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className="brand-page">
        <span className="eyebrow">PRIVATE · GROWTH</span>
        <h1>What brings people closer?</h1>
        <p>
          Consented activity collected since this release. Anonymous browser IDs
          approximate people; devices, resets, blockers and declined analytics
          limit coverage.
        </p>
        <label>
          Window{" "}
          <select value={days} onChange={(e) => setDays(+e.target.value)}>
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        {!data && !error && <p>Loading evidence…</p>}
        {data && (
          <>
            {(data.truncated || data.payments_truncated) && (
              <p role="alert">
                Read limit reached. These counts are partial; narrow the date
                window before making a decision.
              </p>
            )}
            <p className="small muted">
              Updated {data.generated_at} · {data.events} eligible events · QA
              events excluded. Browser events are observations, not verified
              account creation.
            </p>
            <section className="feature-grid">
              <div className="feature-card">
                <h2>{data.visitors}</h2>
                <p>Observed browser visitors</p>
              </div>
              <div className="feature-card">
                <h2>
                  {data.article.engaged} / {data.article.readers}
                </h2>
                <p>
                  Engaged article readers / readers
                  <br />
                  30 active seconds and 75% depth
                </p>
              </div>
              <div className="feature-card">
                <h2>{data.article.subsequent_signups}</h2>
                <p>
                  Article readers who later submitted a successful signup
                  (confirmation may still be pending)
                </p>
              </div>
            </section>
            <h2>Ordered conversion funnel</h2>
            <p>
              Unique browser visitors completing each step in order within the
              window. People who skip a step are excluded from later stages
              here; see activity counts below.
            </p>
            <div className="story-table">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Visitors</th>
                    <th>From prior step</th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnel.map((s, i) => (
                    <tr key={s.name}>
                      <td>{s.name.replaceAll("_", " ")}</td>
                      <td>{s.visitors ?? "Unavailable"}</td>
                      <td>
                        {i && data.funnel[i - 1].visitors && s.visitors !== null
                          ? (
                              (s.visitors / data.funnel[i - 1].visitors) *
                              100
                            ).toFixed(1) + "%"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Payment completion comes from Stripe’s live, paid subscription
              checkouts, never browser success events. Test mode and labelled QA
              are excluded. This measures initial checkout completion, not
              retained revenue, refunds or current entitlement.
            </p>
            <p>
              {data.payments
                ? `${data.payments.completed_checkouts} completed paid checkouts; ${data.payments.unattributed_checkouts} lack a matching observed visitor.`
                : "Stripe evidence unavailable. Payment counts are unknown."}
            </p>
            <h2>Where people spend attention</h2>
            <div className="story-table">
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Views</th>
                    <th>Visitors</th>
                    <th>30s engaged</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.map((p) => (
                    <tr key={p.path}>
                      <td>{p.path}</td>
                      <td>{p.views}</td>
                      <td>{p.visitors}</td>
                      <td>{p.engaged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>Click and scroll heatmaps</h2>
            <p>
              Aggregate click density by percentage of page width and document
              depth, separated by mobile/desktop. This is a spatial grid, not a
              screenshot overlay or session replay. Layout changes can move
              elements; all events here use release 2026-10-08-v1.
            </p>
            <label>
              Page{" "}
              <select value={path} onChange={(e) => setPath(e.target.value)}>
                {[
                  ...new Set([
                    "/blog/why-we-passed-marlins-diamondbacks",
                    ...data.pages.map((p) => p.path),
                  ]),
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>{" "}
            <label>
              Device{" "}
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              >
                <option>mobile</option>
                <option>desktop</option>
              </select>
            </label>
            <div
              className="heatmap"
              aria-label={`${points.length} clicks: left to right across the page, top to bottom down the document`}
            >
              {bins.map((n, i) => (
                <div
                  key={i}
                  title={`${(i % 10) * 10}–${(i % 10) * 10 + 10}% width, ${Math.floor(i / 10) * 10}–${Math.floor(i / 10) * 10 + 10}% depth: ${n} clicks`}
                  style={{
                    background: `rgba(17,116,100,${n ? 0.15 + (n / max) * 0.85 : 0.03})`,
                    color: n / max > 0.5 ? "white" : "#183c35",
                  }}
                >
                  {n || "·"}
                </div>
              ))}
            </div>
            <p>
              {points.length} clicks. Scroll reach across both device types:{" "}
              {[25, 50, 75, 90]
                .map((d) => `${d}%: ${page?.depths?.[d] || 0} visitors`)
                .join(" · ")}
            </p>
            <h2>Sources and campaigns</h2>
            <ul>
              {data.sources.map((s) => (
                <li key={s.source}>
                  {s.source}: {s.visitors} visitors
                </li>
              ))}
            </ul>
            <h2>Most clicked destinations</h2>
            <ul>
              {data.targets.map((t) => (
                <li key={t.target}>
                  {t.target}: {t.clicks}
                </li>
              ))}
            </ul>
            <details>
              <summary>All event counts and troubleshooting</summary>
              <pre>{JSON.stringify(data.clientCounts, null, 2)}</pre>
              <p>
                A missing event may reflect declined consent, blockers or
                collection failure. Compare API write checks and actual payment
                records before treating a blank funnel as no demand.
              </p>
            </details>
            <h2>Use the evidence</h2>
            <ol>
              <li>Few visits: test distribution and the opening message.</li>
              <li>
                Visits but few engaged readers: inspect the introduction and
                mobile experience.
              </li>
              <li>
                Engaged readers but few signup clicks: improve the offer and
                next step.
              </li>
              <li>
                Signup attempts without success: investigate the signup flow.
              </li>
              <li>
                Checkout clicks without paid checkouts: inspect payment errors
                and ask about price objections.
              </li>
            </ol>
            <p>
              Report counts with every rate. Small samples suggest questions;
              they do not establish a winning channel.
            </p>
          </>
        )}
      </main>
    </>
  );
}
