export default function Sportsbooks() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Recommended Sportsbooks</h1>
      <div className="space-y-6">
        {[
          {
            name: 'FanDuel Sportsbook',
            url: 'https://affiliate.fanduel.com/SharpSignal',
            bonus: 'Bet $5, Get $150 in Bonus Bets',
            description: 'Fast payouts, great live betting, wide market coverage.'
          },
          {
            name: 'DraftKings Sportsbook',
            url: 'https://affiliate.draftkings.com/SharpSignal',
            bonus: 'Up to $200 in bonus bets',
            description: 'Trusted platform with frequent promos.'
          },
        ].map((book, i) => (
          <div key={i} className="border p-4 rounded-lg bg-white shadow">
            <h2 className="text-xl font-bold">{book.name}</h2>
            <p className="text-sm text-gray-600 mb-2">{book.description}</p>
            <a
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm"
            >
              Claim Offer: {book.bonus}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
