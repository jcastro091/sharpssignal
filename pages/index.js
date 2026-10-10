import SignalProcess from '../components/SignalProcess';
import Head from "next/head";
import Link from "next/link";
import SignalPreview from "../components/SignalPreview";
export default function Home() {
  return (
    <>
      <Head>
        <title>SharpsSignal | Find your signal.</title>
        <meta
          name="description"
          content="Sports picks with captured odds, clear timing and tracked results. Explore SharpsSignal free, then add real-time access and Telegram."
        />
      </Head>
      <main className="brand-page">
        <section className="brand-hero">
          <div className="hero-copy">
            <span className="eyebrow">SPORTS PICKS. CLEAR PRICES. TRACKED RESULTS.</span>
            <h1>
              Less noise.
              <br />
              <span>More signal.</span>
            </h1>
            <p>
              Know the play. See the price. Follow the result.
              SharpsSignal brings sports selections, sportsbook odds and
              graded outcomes into one clear view. Start free, then upgrade
              for real-time access and Sports alerts on Telegram.
            </p>
            <div className="hero-actions">
              <Link className="button-primary" href="/signup">
                Find your signal <span>↗</span>
              </Link>
              <Link className="button-secondary" href="/picks-preview">
                Explore the preview
              </Link>
            </div>
            <small className="muted">
              Free account. No card required. Free feeds have a minimum 30-minute delay.
            </small>
          </div>
          <SignalPreview />
        </section>
        <div className="brand-strip">
          <span>PRICE & TIME RECORDED</span>
          <span>ALERT TO RESULT</span>
          <span>RESULTS WITH CONTEXT</span>
        </div>
        <SignalProcess />
        <section className="feature-section">
          <span className="eyebrow">BUILT AROUND YOU</span>
          <h2>
            Follow your interests.
            <br />
            Keep the full picture.
          </h2>
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon">↗</span>
              <h3>Sports, in focus.</h3>
              <p>
                See the selection, sportsbook, captured odds and game time.
                Follow each released play through grading, with closing-price
                comparisons when available. Alert frequency depends on
                qualifying opportunities.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-icon">▥</span>
              <h3>Markets, with context.</h3>
              <p>
                Interested in Markets too? Add it to your interests for a
                separate view of experimental paper trades, entry prices, and
                recorded outcomes.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-icon">◎</span>
              <h3>Your space. Your pace.</h3>
              <p>
                Start with the free dashboard. Upgrade for real-time access
                and connect your Sports Telegram channel from billing.
                Check results on the dashboard as plays are graded.
              </p>
            </article>
          </div>
        </section>
        <section className="feature-section">
          <span className="eyebrow">FROM THE RESEARCH NOTES</span>
          <h2>Why we passed on Marlins–Diamondbacks.</h2>
          <p>
            A positive estimate still needed confirmation. Five and a half
            minutes later, the next saved check no longer qualified. Follow the
            actual record.
          </p>
          <Link
            className="button-secondary"
            data-track="home_article"
            href="/blog/why-we-passed-marlins-diamondbacks"
          >
            Read the decision →
          </Link>
        </section>
        <section className="brand-callout">
          <div>
            <span className="eyebrow">EVIDENCE OVER HYPE</span>
            <h2>A good signal deserves an honest record.</h2>
            <p>
              Wins, losses and pending results each have a place. Simulated
              selections are identified in the feed and kept distinct from
              verified wagers. Explore our private verification and aggregate
              attestation standards.
            </p>
          </div>
          <Link className="button-secondary" href="/verification">
            How verification works ↗
          </Link>
        </section>
      </main>
    </>
  );
}
