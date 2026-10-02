import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { requireServerUser } from "../lib/authServer";
import { getCeoAccess } from "../lib/ceoAccess";
import { supabase } from "../lib/supabaseClient";
import { trackMemberEvent } from "../lib/memberAnalytics";
import {
  feedState,
  firstRecordIndex,
  resultLabel,
} from "../lib/memberResearch";
import { checkoutDestination } from "../lib/authRedirect";
import CheckoutStatus from "../components/CheckoutStatus";
import ResearchGuide from "../components/ResearchGuide";
import ResearchStatus from "../components/ResearchStatus";

export async function getServerSideProps({ req, res, query }) {
  res.setHeader("Cache-Control", "private, no-store");
  const auth = await requireServerUser(req, res);
  if (!auth.user)
    return {
      redirect: { destination: "/signin?next=" + encodeURIComponent(checkoutDestination(query)), permanent: false },
    };
  const access = await getCeoAccess(req, res);
  const interests = Array.isArray(auth.user.user_metadata?.interests)
    ? auth.user.user_metadata.interests.filter((x) =>
        ["sports", "markets"].includes(x),
      )
    : ["sports", "markets"];
  return { props: { initialInterests: interests, isAdmin: access.allowed } };
}
const stamp = (x) => {
  if (!x) return "Unavailable";
  const d = new Date(typeof x === "number" ? x * 1000 : x);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unavailable";
};
const human = (x) => String(x || "Unavailable").replaceAll("_", " ");
export default function Dashboard({ initialInterests, isAdmin }) {
  const [interests, setInterests] = useState(initialInterests),
    [section, setSection] = useState(initialInterests[0] || "sports");
  const [feed, setFeed] = useState(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false),
    [notice, setNotice] = useState(""),
    [opened, setOpened] = useState(null),
    [feedback, setFeedback] = useState(false);
  const recordRef = useRef(null);
  useEffect(() => {
    if (!interests.includes(section)) return;
    let active = true;
    const controller = new AbortController();
    setFeed(null);
    setError("");
    setOpened(null);
    fetch("/api/member-feed?section=" + section, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.ok === false || !Array.isArray(d.plays))
          throw Error("Feed unavailable");
        if (active) setFeed(d);
      })
      .catch(() => {
        if (active) setError("Feed unavailable");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [section, refresh, interests]);
  useEffect(() => {
    if (opened !== null) recordRef.current?.focus();
  }, [opened]);
  async function preference(x) {
    const next = interests.includes(x)
      ? interests.filter((i) => i !== x)
      : [...interests, x];
    if (!next.length) {
      setNotice("Keep at least one interest selected.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { interests: next },
      });
      if (error) throw error;
      setInterests(next);
      if (!next.includes(section)) setSection(next[0]);
      setNotice("Interests saved.");
    } catch {
      setNotice("Could not save your interests. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  const state = feedState(feed, error);
  const plays = ["available", "stale"].includes(state.kind) ? feed.plays : [];
  const record = opened === null ? null : plays[opened];
  function openRecord(index) {
    setOpened(index);
    trackMemberEvent("record_view", { section });
  }
  return (
    <main className="member-shell">
      <aside className="member-nav">
        <span className="eyebrow">YOUR WORKSPACE</span>
        {interests.map((x) => (
          <button
            key={x}
            aria-current={section === x ? "page" : undefined}
            onClick={() => {
              setSection(x);
              setFeed(null);
              setOpened(null);
            }}
          >
            {x === "sports" ? "↗ Sports" : "▥ Markets"}
          </button>
        ))}
        <details>
          <summary>My interests</summary>
          {["sports", "markets"].map((x) => (
            <label key={x}>
              <input
                type="checkbox"
                checked={interests.includes(x)}
                disabled={saving}
                onChange={() => preference(x)}
              />
              {human(x)}
            </label>
          ))}
          <p role="status" className="small">
            {notice}
          </p>
        </details>
        {isAdmin && (
          <Link className="admin-link" href="/admin">
            Admin workspace ↗
          </Link>
        )}
        <small>
          Paper research only.
          <br />
          No live orders.
        </small>
      </aside>
      <div className="member-content">
        <CheckoutStatus />
        <div className="member-top">
          <span className="eyebrow">YOUR SIGNAL / {section.toUpperCase()}</span>
          <button
            className="button-secondary"
            onClick={() => setRefresh(refresh + 1)}
          >
            Refresh
          </button>
        </div>
        <h1>
          {section === "sports" ? "Your sports signal." : "Your market view."}
        </h1>
        <p className="muted">
          Forward paper records, with context. No guaranteed edge or real-money
          execution.
        </p>
        <section className="member-panel compact-panel">
          <h2>Start with one record.</h2>
          <p>
            Read the brief guide, then open an available record. We start with a
            settled result when one is shown; otherwise, start with what is
            available. Markets can be added in My interests.
          </p>
          <ResearchGuide key={section} section={section} />
          {plays.length > 0 ? (
            <button
              className="button-primary"
              onClick={() => openRecord(firstRecordIndex(plays, section))}
            >
              Open a record ↗
            </button>
          ) : (
            <Link className="button-secondary" href="/picks-preview">
              Read the fictional example ↗
            </Link>
          )}
        </section>
        <ResearchStatus feed={feed} error={error} section={section} />
        <section className="member-panel">
          <div className="panel-title">
            <h2>Paper activity</h2>
            <span className="status-pill">
              {feed?.observed_at
                ? "Observed " + stamp(feed.observed_at)
                : "Observation time unavailable"}
            </span>
          </div>
          <p className="small muted">
            Up to 100 available member records. Counts describe this view, not
            total research activity. Overlapping strategies are not independent
            bets.
          </p>
          {state.kind === "unavailable" ? (
            <div role="alert" className="error-message">
              Data unavailable. Try Refresh to check again. No example data has
              been substituted.
            </div>
          ) : state.kind === "loading" ? (
            <p role="status">Loading your feed…</p>
          ) : !plays.length ? (
            <div className="empty-state">
              <h3>{state.title}</h3>
              <p>{state.detail}</p>
            </div>
          ) : (
            <div className="member-table">
              <table>
                <thead>
                  <tr>
                    {(section === "sports"
                      ? [
                          "Selection / game",
                          "Strategy",
                          "Captured odds",
                          "Game time",
                          "Paper result",
                          "Closing evidence (CLV)",
                        ]
                      : [
                          "Symbol / direction",
                          "Entry",
                          "Stop / target",
                          "Recorded",
                          "Status",
                          "Paper P&L",
                        ]
                    ).map((x) => (
                      <th key={x} scope="col">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plays.map((p, i) => (
                    <tr key={p.entry_id || p.trade_id || i}>
                      {section === "sports" ? (
                        <>
                          <td>
                            <button
                              className="record-link"
                              onClick={() => openRecord(i)}
                            >
                              {p.side || "Selection unavailable"}
                              {p.point != null ? " " + p.point : ""} ↗
                            </button>
                            <small>
                              {p.away} @ {p.home} · {human(p.market)}
                            </small>
                          </td>
                          <td>
                            {p.arm}
                            <small>{p.cohort}</small>
                          </td>
                          <td>
                            {p.decimal ?? "Unavailable"}
                            <small>{p.book}</small>
                          </td>
                          <td>{stamp(p.start)}</td>
                          <td>{resultLabel(p)}</td>
                          <td>
                            {Number.isFinite(p.clv_pct)
                              ? (p.clv_pct * 100).toFixed(2) + "%"
                              : "Unavailable"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <button
                              className="record-link"
                              onClick={() => openRecord(i)}
                            >
                              {p.symbol} ↗
                            </button>
                            <small>
                              {p.direction > 0 ? "Long" : "Short"} · {p.family}
                            </small>
                          </td>
                          <td>{p.entry_price ?? "Unavailable"}</td>
                          <td>
                            {p.stop ?? "—"} / {p.target ?? "—"}
                          </td>
                          <td>{stamp(p.entry_time)}</td>
                          <td>{resultLabel(p, section)}</td>
                          <td>
                            {p.status === "closed"
                              ? Number.isFinite(p.net_pnl)
                                ? "$" + p.net_pnl.toFixed(2)
                                : "Unavailable"
                              : resultLabel(p, section) === "Pending"
                                ? "Pending"
                                : "Unavailable"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {record && (
          <section
            className="member-panel compact-panel"
            tabIndex={-1}
            ref={recordRef}
            aria-label="Opened member record"
          >
            <span className="eyebrow">
              AVAILABLE MEMBER RECORD · PAPER ONLY
            </span>
            <h2>{section === "sports" ? record.side : record.symbol}</h2>
            <p>
              Captured{" "}
              {section === "sports"
                ? "odds: " + (record.decimal ?? "unavailable")
                : "entry: " + (record.entry_price ?? "unavailable")}
              . Paper result: {resultLabel(record, section)}.
            </p>
            {section === "sports" && (
              <p>
                {Number.isFinite(record.clv_pct)
                  ? "Closing-price comparison (CLV): " +
                    (record.clv_pct * 100).toFixed(2) +
                    "%. This comparison is separate from the result."
                  : "Closing-price comparison unavailable. This is not a zero or a losing result."}{" "}
                The raw closing price is not supplied in this member feed.
              </p>
            )}
            <p>
              Past entries explain the research; they are not current
              opportunities.
            </p>
            <button
              className="button-secondary"
              onClick={() => setOpened(null)}
            >
              Close record
            </button>
          </section>
        )}
        <section className="member-panel compact-panel">
          <h2>Was it clear where to start?</h2>
          <p>Optional · one answer, no contact details requested.</p>
          {feedback ? (
            <p role="status">Thanks for the feedback.</p>
          ) : (
            <div className="hero-actions">
              {[
                ["yes", "Yes"],
                ["not_yet", "Not yet"],
              ].map(([answer, label]) => (
                <button
                  key={answer}
                  className="button-secondary"
                  onClick={() => {
                    trackMemberEvent("member_feedback", { section, answer });
                    setFeedback(true);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="member-panel compact-panel">
          <h2>Notifications</h2>
          <p>
            Email, SMS, and push play alerts are not activated for member
            accounts. Check this dashboard for recorded paper activity.
          </p>
        </section>
      </div>
    </main>
  );
}
