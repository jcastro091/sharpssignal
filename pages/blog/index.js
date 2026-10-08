import Head from "next/head";
import Link from "next/link";
export default function Blog() {
  return (
    <>
      <Head>
        <title>Research notes | SharpsSignal</title>
        <meta
          name="description"
          content="Real decisions, documented observations, and the reasoning behind SharpsSignal research."
        />
        <link rel="canonical" href="https://www.sharps-signal.com/blog" />
      </Head>
      <main className="brand-page">
        <span className="eyebrow">RESEARCH NOTES</span>
        <h1>The reasoning behind the record.</h1>
        <p>
          Real examples of what we saw, what qualified, and what still needed
          evidence.
        </p>
        <article className="feature-card">
          <p className="small muted">October 8, 2026 · Decision review</p>
          <h2>
            <Link
              data-track="blog_article"
              href="/blog/why-we-passed-marlins-diamondbacks"
            >
              Why we passed on Marlins–Diamondbacks →
            </Link>
          </h2>
          <p>
            A positive estimate, confirmation still pending, and a price that no
            longer qualified at the next saved check.
          </p>
        </article>
      </main>
    </>
  );
}
