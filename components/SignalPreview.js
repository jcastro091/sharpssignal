import { useState } from "react";
export default function SignalPreview() {
  const [section, setSection] = useState("sports");
  return (
    <div className="signal-preview">
      <div className="preview-top">
        <span className="status-pill">
          Fictional example · not a live signal
        </span>
      </div>
      <div className="segmented">
        <button
          aria-pressed={section === "sports"}
          onClick={() => setSection("sports")}
        >
          Sports
        </button>
        <button
          aria-pressed={section === "markets"}
          onClick={() => setSection("markets")}
        >
          Markets
        </button>
      </div>
      <div className="preview-card" key={section}>
        <span className="eyebrow">
          {section === "sports"
            ? "EXAMPLE RECORD · PAPER ONLY"
            : "MARKETS · SEPARATE RESEARCH VIEW"}
        </span>
        <h3>
          {section === "sports"
            ? "Example Team A vs Team B"
            : "Explore Markets at your pace."}
        </h3>
        <p>
          {section === "sports"
            ? "Illustrative selection: Team A to win. These invented teams and odds explain the format only."
            : "Add Markets in My interests for available experimental paper trades. Sports remains its own view."}
        </p>
        {section === "sports" ? (
          <>
            <div className="preview-metrics">
              <div>
                <small>American odds</small>
                <b>+100</b>
              </div>
              <div>
                <small>Paper result</small>
                <b>Pending</b>
              </div>
              <div>
                <small>Closing price</small>
                <b>Unavailable</b>
              </div>
            </div>
            <p className="preview-explanation">
              The entry price is recorded. The result has not been graded. No
              closing comparison is available, so this example has no CLV or
              profit to report.
            </p>
          </>
        ) : (
          <p>
            Entry, stop / target, and recorded paper results — when a record has
            been released for members. No live orders or guaranteed returns.
          </p>
        )}
      </div>
      <small className="muted">
        Illustration only. Your member feed can be empty, pending, or
        unavailable.
      </small>
    </div>
  );
}
