import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { loadSeoPage, type SeoPage } from "../../lib/publicGrowth";

type Props = {
  page: SeoPage;
};

export default function MlbMatchupPage({ page }: Props) {
  return (
    <>
      <Head>
        <title>{page.title} | SharpSignal</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={page.canonical_url} />
      </Head>

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="max-w-3xl">
              <div className="inline-flex rounded border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                MLB matchup context
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
                {page.away_team} vs {page.home_team}
              </h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Free matchup context for {page.game_date}. This page is built for research and transparency; paid signal
                metrics and book-specific recommendations are not shown here.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/picks-preview" className="rounded bg-slate-950 px-5 py-3 text-center font-semibold text-white hover:bg-slate-800">
                  View public preview
                </Link>
                <Link href="/about" className="rounded border border-slate-300 px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50">
                  See proof process
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="rounded border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-500">Away</div>
            <div className="mt-2 text-xl font-bold">{page.away_team}</div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-500">Home</div>
            <div className="mt-2 text-xl font-bold">{page.home_team}</div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-500">Game date</div>
            <div className="mt-2 text-xl font-bold">{page.game_date}</div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="grid gap-6 rounded border border-slate-200 bg-slate-50 p-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="text-2xl font-semibold">What this page includes</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Matchup identity, date, public audit context, and links into the transparent SharpSignal preview flow.
                It is meant to help readers inspect the record before deciding whether the paid product is useful.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold">What this page excludes</h2>
              <p className="mt-3 leading-7 text-slate-600">
                No guaranteed language, no hidden record, no paid signal metrics, and no recommendation to wager beyond
                your own limits. Bet responsibly and only where legal.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, res }) => {
  const slug = String(params?.slug || "");
  const page = await loadSeoPage(slug);
  if (!page) {
    return { notFound: true };
  }
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  return { props: { page } };
};
