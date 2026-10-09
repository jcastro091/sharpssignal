import Link from "next/link";
import SignalPreview from "../components/SignalPreview";
import ResearchGuide from "../components/ResearchGuide";
export default function Preview() {
  return (
    <main className="brand-page">
      <section className="brand-hero">
        <div className="hero-copy">
          <span className="eyebrow">A LOOK INSIDE · FICTIONAL EXAMPLE</span>
          <h1>
            Follow the price.
            <br />
            <span>Read the result.</span>
          </h1>
          <p>
            See how a selection arrives and how its result is recorded.
            Each play connects the captured odds, game time and outcome.
            Closing-price comparisons appear when available.
          </p>
          <p>
            This example explains the format. It is not a historical selection
            or a current opportunity. Your dashboard may have no published
            records yet.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/signup">
              Create your free account ↗
            </Link>
          </div>
          <small className="muted">
            No card required. Upgrade for real-time access and Telegram.
          </small>
        </div>
        <SignalPreview />
      </section>
      <ResearchGuide open />
    </main>
  );
}
