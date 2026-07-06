import { AFFILIATE_DISCLOSURE, SPORTSBOOK_OFFERS, sportsbookOfferUrl } from "../lib/sportsbookOffers";

export default function Sportsbooks() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-3 text-center text-3xl font-bold">Recommended Sportsbooks</h1>
      <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-6 text-slate-600">
        Use these books for line shopping when an alert shows a best available price. Pinnacle remains the sharp reference; these are the retail outs to compare.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {SPORTSBOOK_OFFERS.map((book) => (
          <div key={book.key} className="rounded border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">{book.name}</h2>
            <p className="mb-4 mt-2 text-sm leading-6 text-gray-600">{book.description}</p>
            <a
              href={sportsbookOfferUrl(book.name)}
              target={sportsbookOfferUrl(book.name).startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {book.bonus}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-8 rounded border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        {AFFILIATE_DISCLOSURE}
      </p>
    </div>
  );
}
