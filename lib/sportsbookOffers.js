export const AFFILIATE_DISCLOSURE =
  "Affiliate disclosure: SharpSignal may earn compensation if you sign up through an offer link. 21+ where legal. Bet responsibly.";

export const SPORTSBOOK_OFFERS = [
  {
    key: "fanduel",
    name: "FanDuel",
    env: "NEXT_PUBLIC_AFFILIATE_FANDUEL_URL",
    fallbackPath: "/sportsbooks?book=fanduel",
    bonus: "Check current FanDuel offer",
    description: "Core retail book for line shopping and best-price alerts.",
  },
  {
    key: "draftkings",
    name: "DraftKings",
    env: "NEXT_PUBLIC_AFFILIATE_DRAFTKINGS_URL",
    fallbackPath: "/sportsbooks?book=draftkings",
    bonus: "Check current DraftKings offer",
    description: "Core retail book for line shopping and best-price alerts.",
  },
  {
    key: "caesars",
    name: "Caesars",
    env: "NEXT_PUBLIC_AFFILIATE_CAESARS_URL",
    fallbackPath: "/sportsbooks?book=caesars",
    bonus: "Check current Caesars offer",
    description: "Retail price source for best available book comparisons.",
  },
  {
    key: "betmgm",
    name: "BetMGM",
    env: "NEXT_PUBLIC_AFFILIATE_BETMGM_URL",
    fallbackPath: "/sportsbooks?book=betmgm",
    bonus: "Check current BetMGM offer",
    description: "Retail price source for best available book comparisons.",
  },
  {
    key: "fanatics",
    name: "Fanatics",
    env: "NEXT_PUBLIC_AFFILIATE_FANATICS_URL",
    fallbackPath: "/sportsbooks?book=fanatics",
    bonus: "Check current Fanatics offer",
    description: "Additional retail coverage where available.",
  },
  {
    key: "espnbet",
    name: "ESPN BET",
    env: "NEXT_PUBLIC_AFFILIATE_ESPNBET_URL",
    fallbackPath: "/sportsbooks?book=espnbet",
    bonus: "Check current ESPN BET offer",
    description: "Additional retail coverage where available.",
  },
  {
    key: "ballybet",
    name: "Bally Bet",
    env: "NEXT_PUBLIC_AFFILIATE_BALLYBET_URL",
    fallbackPath: "/sportsbooks?book=ballybet",
    bonus: "Check current Bally Bet offer",
    description: "Additional retail coverage where available.",
  },
];

const BOOK_ALIASES = {
  fanduel: "fanduel",
  fd: "fanduel",
  draftkings: "draftkings",
  "draft kings": "draftkings",
  dk: "draftkings",
  caesars: "caesars",
  caesar: "caesars",
  betmgm: "betmgm",
  "bet mgm": "betmgm",
  mgm: "betmgm",
  fanatics: "fanatics",
  "espn bet": "espnbet",
  espnbet: "espnbet",
  bally: "ballybet",
  "bally bet": "ballybet",
  ballybet: "ballybet",
};

function normalizedBookKey(value) {
  const key = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return BOOK_ALIASES[key] || key.replace(/\s+/g, "");
}

export function sportsbookOfferFor(book) {
  const key = normalizedBookKey(book);
  return SPORTSBOOK_OFFERS.find((offer) => offer.key === key) || null;
}

export function sportsbookOfferUrl(book) {
  const offer = sportsbookOfferFor(book);
  if (!offer) return "/sportsbooks";
  const configured = process.env[offer.env];
  return configured || offer.fallbackPath;
}

export function sportsbookOfferLabel(book) {
  const offer = sportsbookOfferFor(book);
  return offer ? `Open ${offer.name}` : "Open sportsbook offers";
}
