import { feedState, resultLabel } from "../lib/memberResearch";
export default function ResearchStatus({ feed, error, section }) {
  const state = feedState(feed, error);
  const usable = ["available", "stale", "empty"].includes(state.kind);
  return (
    <>
      <div className="member-stats" aria-label="Member record status">
        <article>
          <small>Shown records</small>
          <b>{usable ? feed.plays.length : "—"}</b>
        </article>
        <article>
          <small>Pending results</small>
          <b>
            {usable
              ? feed.plays.filter((p) => resultLabel(p, section) === "Pending")
                  .length
              : "—"}
          </b>
        </article>
        <article>
          <small>Data status</small>
          <b>{state.title}</b>
        </article>
      </div>
      <p role="status" className="small muted">
        {state.detail}
      </p>
    </>
  );
}
