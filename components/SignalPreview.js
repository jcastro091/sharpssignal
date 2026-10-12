import { useEffect, useState } from "react";
import TeamLogo from "./TeamLogo";

const stages = ["Play arrives", "Result graded"];
export default function SignalPreview() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [outcome, setOutcome] = useState("win");
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!preference.matches);
    const changed = () => setPlaying(!preference.matches);
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStage(value => 1 - value), 6500);
    return () => clearInterval(timer);
  }, [playing]);
  const selectStage = value => { setPlaying(false); setStage(value); };
  const result = outcome === "win" ? ["Win", "+0.87u"] : ["Loss", "−1.00u"];
  return <section className="signal-preview lifecycle-preview" aria-label="Example play from alert to graded result">
    <div className="preview-top"><span className="status-pill">Illustrative example</span><button className="lifecycle-pause" onClick={() => setPlaying(value => !value)}>{playing ? "Pause" : "Play animation"}</button></div>
    <div className="segmented">{stages.map((label, index) => <button key={label} aria-pressed={stage === index} onClick={() => selectStage(index)}>{index + 1}. {label}</button>)}</div>
    <div className="lifecycle-window"><article className="latest-signal-card lifecycle-card" key={stage}>
      <div className="signal-card-top"><span className="eyebrow">Spreads</span><span className={`status-pill ${stage === 1 ? `result-${outcome}` : ""}`}>{stage === 0 ? "Pending" : result[0]}</span></div>
      <div className="signal-team-logos"><TeamLogo name="Baltimore Ravens" sport="americanfootball_nfl"/><span>vs</span><TeamLogo name="Atlanta Falcons" sport="americanfootball_nfl"/></div>
      <h3>Baltimore Ravens +3.5</h3>
      <p className="signal-matchup">Baltimore Ravens @ Atlanta Falcons</p>
      <dl className="signal-levels"><div><dt>Captured odds</dt><dd>−115</dd></div><div><dt>Sportsbook</dt><dd>ESPN Bet</dd></div></dl>
      <div className="signal-card-details"><p><span>Game time</span><b>Oct 11, 8:20 PM ET</b></p><p><span>Recorded</span><b>Oct 11, 7:48 PM ET</b></p></div>
      <button className="button-primary lifecycle-track" disabled>{stage === 0 ? "Tail this pick" : "Tracking closed"}</button>
      {stage === 1 && <div className="lifecycle-settlement"><p><span>Example tracked stake</span><b>1.00u</b></p><p><span>Net result</span><b>{result[1]}</b></p><p className="signal-card-note">{outcome === "win" ? "Illustrative win: Ravens cover +3.5. A 1u stake at −115 returns 1.87u, including the original stake." : "Illustrative loss: Ravens do not cover +3.5. A losing 1u stake is recorded as −1.00u."}</p></div>}
      <p className="signal-card-note">Illustrative selection · captured odds may have changed.</p>
    </article></div>
    <div className="lifecycle-outcomes" aria-label="Explore example results">{["win", "loss"].map(value => <button key={value} aria-pressed={stage === 1 && outcome === value} onClick={() => { setOutcome(value); selectStage(1); }}>Show {value}</button>)}</div>
    <small className="muted">Real team logos and the same card format as your feed. Outcomes are hypothetical; this is not a live alert or performance claim. Results update on the dashboard. Simulated records are labeled in your feed.</small>
  </section>;
}
