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
          content="Follow sports research from captured price to paper result. Free access to available member records, with Markets research alongside."
        />
      </Head>
      <main className="brand-page">
        <section className="brand-hero">
          <div className="hero-copy">
            <span className="eyebrow">SPORTS RESEARCH · FREE TO FOLLOW</span>
            <h1>
              Less noise.
              <br />
              <span>More signal.</span>
            </h1>
            <p>
              Follow sports research from captured price to paper result. Your
              free dashboard brings together available member records, captured
              odds, and results as they are recorded. See what happened, what is
              pending, and what is not yet measured.
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
              Free account. No card required. Paper research, not a promise of
              profit.
            </small>
          </div>
          <SignalPreview />
        </section>
        <div className="brand-strip">
          <span>CAPTURED, NOT INVENTED</span>
          <span>SPORTS + MARKETS</span>
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
                Start with an available sports record. Compare the captured odds
                with the paper result and closing-price evidence, when
                available. No qualifying entry or no published record can mean
                an empty feed.
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
                Start with Sports and change your interests anytime. A brief
                guide helps you read your first record. Check the dashboard for
                updates; automatic email, SMS, and push play alerts are not
                active.
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
              Private verification and aggregate attestation protect the
              research while keeping its limitations visible. A winning streak
              is not proof of an edge.
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
