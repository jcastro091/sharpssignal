import { useEffect, useState } from "react";

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
  const result = outcome === "win" ? ["WIN", "+1.10u"] : ["LOSS", "−1.00u"];
  return <section className="signal-preview lifecycle-preview" aria-label="Example play from alert to graded result">
    <div className="preview-top"><span className="status-pill">Illustrative example</span><button className="lifecycle-pause" onClick={() => setPlaying(value => !value)}>{playing ? "Pause" : "Play animation"}</button></div>
    <div className="segmented">{stages.map((label, index) => <button key={label} aria-pressed={stage === index} onClick={() => selectStage(index)}>{index + 1}. {label}</button>)}</div>
    <div className="lifecycle-window"><div className="preview-card lifecycle-card" key={stage}>
      <span className="eyebrow">SHARPSSIGNAL / SPORTS</span>
      <div className="lifecycle-heading"><h3>{stage === 0 ? "New play" : "Graded result"}</h3><span className={`status-pill ${stage === 1 ? `result-${outcome}` : ""}`}>{stage === 0 ? "PENDING" : result[0]}</span></div>
      <p className="lifecycle-matchup">Example Away @ Example Home · Moneyline</p>
      <strong className="lifecycle-pick">Example Home to win</strong>
      <div className="preview-metrics"><div><small>Captured odds</small><b>+110</b></div><div><small>Tracked stake</small><b>1.00u</b></div><div><small>{stage === 0 ? "Sportsbook" : "Net result"}</small><b>{stage === 0 ? "Example book" : result[1]}</b></div></div>
      {stage === 0 ? <><p className="preview-explanation">Recorded 6:10 PM ET · Game starts 7:10 PM ET</p><p>Selection, sportsbook and timestamp together. Check the available price before placing your own bet.</p></> : <><p className="preview-explanation">{outcome === "win" ? "Final score: Away 2 · Home 4" : "Final score: Away 4 · Home 2"}</p><p>{outcome === "win" ? "A 1u stake at +110 returns 2.10u, including the original stake. Net: +1.10u." : "A losing 1u stake is recorded as −1.00u. Losses remain in the record."}</p></>}
      <div className="lifecycle-receipt"><span>Example ID SS-001</span><span>{stage === 0 ? "Awaiting final score" : "Same play · updated result"}</span></div>
    </div></div>
    <div className="lifecycle-outcomes" aria-label="Explore example results">{["win", "loss"].map(value => <button key={value} aria-pressed={stage === 1 && outcome === value} onClick={() => { setOutcome(value); selectStage(1); }}>Show {value}</button>)}</div>
    <small className="muted">Fictional teams, prices and results explain the format; this is not a live alert or performance claim. Results update on the dashboard. Simulated records are labeled in your feed.</small>
  </section>;
}
