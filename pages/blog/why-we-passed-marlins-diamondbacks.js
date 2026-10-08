import Head from "next/head";
import Link from "next/link";
import evidence from "../../public/evidence/marlins-diamondbacks-2026-09-15.json";

export default function Article() {
  const title = "Why we passed on Marlins–Diamondbacks";
  const description =
    "A real September 15 decision: a positive estimate, confirmation still pending, and a price that no longer qualified at the next saved check.";
  return (
    <>
      <Head>
        <title>{`${title} | SharpsSignal`}</title>
        <meta name="description" content={description} />
        <link
          rel="canonical"
          href="https://www.sharps-signal.com/blog/why-we-passed-marlins-diamondbacks"
        />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta
          property="og:url"
          content="https://www.sharps-signal.com/blog/why-we-passed-marlins-diamondbacks"
        />
        <meta name="twitter:card" content="summary" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: title,
              datePublished: "2026-10-08",
              dateModified: "2026-10-08",
              author: { "@type": "Organization", name: "SharpsSignal" },
              description,
              mainEntityOfPage:
                "https://www.sharps-signal.com/blog/why-we-passed-marlins-diamondbacks",
            }),
          }}
        />
      </Head>
      <main className="brand-page story-page">
        <article data-article="why-we-passed-marlins-diamondbacks">
          <Link href="/blog" className="record-link">
            ← Research notes
          </Link>
          <header>
            <span className="eyebrow">
              A REAL DECISION · SEPTEMBER 15, 2026
            </span>
            <h1>{title}</h1>
            <p className="story-deck">
              The estimate looked interesting. The setup still hadn’t earned a
              play.
            </p>
            <p className="muted">
              By SharpsSignal · Published October 8, 2026 · 4-minute read
            </p>
          </header>
          <p>
            We’re looking for an edge. So when a game shows a positive estimate,
            why wouldn’t we take it?
          </p>
          <p>
            Because the estimate is only part of the decision. We also need the
            setup to meet its confirmation requirements, and the available price
            still has to qualify.
          </p>
          <p>
            Here’s a real example from our saved records for Miami at Arizona on
            September 15, 2026. At one check, the estimated expected value was
            positive. Confirmation was still pending. At the next saved check,
            the price no longer qualified.
          </p>
          <h2>What we actually recorded</h2>
          <p>
            These times are Eastern Daylight Time on September 15. The source
            file uses UTC, which places the last six checks on September 16.
          </p>
          <div className="story-table">
            <table>
              <caption>Seven saved observations of the same game</caption>
              <thead>
                <tr>
                  <th scope="col">Time (EDT)</th>
                  <th scope="col">Estimated EV</th>
                  <th scope="col">Recorded reason</th>
                </tr>
              </thead>
              <tbody>
                {evidence.observations.map((row) => (
                  <tr key={row.observed_at}>
                    <td>
                      {new Date(row.observed_at).toLocaleTimeString("en-US", {
                        timeZone: "America/New_York",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td>
                      {row.estimated_ev > 0 ? "+" : ""}
                      {(row.estimated_ev * 100).toFixed(2)}%
                    </td>
                    <td>
                      {row.reason === "price_qualified_waiting_confirmation"
                        ? "Price qualified; waiting for confirmation"
                        : "Price below the required level"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            At <strong>8:52:19 p.m.</strong>, the estimate was{" "}
            <strong>+2.32%</strong>. The recorded status was{" "}
            <strong>WATCH</strong>, with the reason “price qualified, waiting
            for confirmation.” That was a setup to keep watching.
          </p>
          <p>
            At <strong>8:57:52 p.m.</strong>, roughly five and a half minutes
            later, the estimate was <strong>−1.55%</strong>. The recorded reason
            had changed to “price below the required level.” At 9:12:52 p.m., it
            was still below that level.
          </p>
          <p>
            All seven saved observations show WATCH, and none contains a
            confirmed paper-play identifier. When we say we passed here, we mean
            the monitored setup stayed unconfirmed in these records. WATCH is
            the actual system label.
          </p>
          <h2>A positive number isn’t the whole answer</h2>
          <p>
            Expected value, or EV, is an estimate based on a probability
            assessment and a price. It is not the chance of winning, and +2.32%
            does not promise a 2.32% return on this game.
          </p>
          <p>
            The question we care about is whether the setup meets the rules at a
            price we can still use. An earlier positive estimate doesn’t give us
            a reason to ignore the next check.
          </p>
          <p>
            That’s why this example matters. We had a moment worth watching,
            followed by a saved observation that no longer met the price
            requirement. We didn’t have a confirmed play in the records shown
            here.
          </p>
          <h2>What this example can—and can’t—tell us</h2>
          <p>
            This is a look at one historical decision sequence. The seven rows
            are repeated checks of one game, not seven independent
            opportunities. They don’t capture every price change between checks.
          </p>
          <p>
            The audit extract does not include the selected side or exact
            sportsbook odds. We’re leaving those out rather than reconstructing
            them. It also doesn’t establish whether a different setup qualified
            elsewhere or later.
          </p>
          <p>
            We’re not using the final score to justify the decision. This is not
            a claim that passing saved a loss, or that these estimates prove a
            profitable strategy. It shows why a promising number didn’t become a
            confirmed play in this sequence.
          </p>
          <h2>What you should expect from us</h2>
          <p>
            If we’re asking you to trust the process, we should be able to
            explain the quiet days too. Sometimes a price isn’t good enough.
            Sometimes confirmation is missing. Those reasons should be visible.
          </p>
          <p>
            Our job is to keep the record clear: what we saw, what the rules
            required, and what happened next. This time, that meant continuing
            to watch instead of treating an unconfirmed estimate as a play.
          </p>
          <aside className="story-source">
            <h2>Check the source</h2>
            <p>
              The table comes from the September 17 audit of archived production
              cycles. The downloadable extract includes the event identifier,
              original timestamps, decision reasons, and the original audit’s
              SHA-256 fingerprint. This is our own operational evidence, not an
              independent audit.
            </p>
            <a
              data-track="article_evidence"
              href="/evidence/marlins-diamondbacks-2026-09-15.json"
            >
              Read the seven source observations →
            </a>
          </aside>
          <section className="brand-callout" data-section="article-next-step">
            <div>
              <h2>See how we track the research.</h2>
              <p>
                Explore the free dashboard’s available paper records, captured
                odds and recorded results. No card required.
              </p>
            </div>
            <Link
              data-track="article_signup"
              className="button-primary"
              href="/signup"
            >
              Create a free account ↗
            </Link>
          </section>
          <p className="small muted">
            Research only. Historical estimates and paper results do not
            guarantee future returns.
          </p>
        </article>
      </main>
    </>
  );
}
