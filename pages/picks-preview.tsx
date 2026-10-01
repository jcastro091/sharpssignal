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
            A free sports-research workspace for available member records. See
            captured odds, paper results, and closing-price evidence when it is
            recorded.
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
            No card required. No automatic email, SMS, or push play alerts.
          </small>
        </div>
        <SignalPreview />
      </section>
      <ResearchGuide open />
    </main>
  );
}
