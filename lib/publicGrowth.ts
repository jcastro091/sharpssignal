import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "./supabaseServer";

const DEFAULT_BASE_URL = "https://www.sharps-signal.com";
const RESPONSIBLE_GAMBLING_URL = "https://www.ncpgambling.org/help-treatment/";

export type SeoPage = {
  sport: string;
  away_team: string;
  home_team: string;
  game_date: string;
  slug: string;
  title: string;
  description: string;
  canonical_url: string;
  updated_at: string | null;
};

export type PublicApiPayload = {
  generated_at: string;
  schema: string;
  disclaimer: string;
  sports: {
    public_audited: {
      kpis: Record<string, number | null>;
      leaderboard: Array<Record<string, string | number | null>>;
    };
  };
  seo_pages: SeoPage[];
  b2b_packages: Array<Record<string, string | number | boolean>>;
};

export const B2B_PACKAGES = [
  {
    package: "Creator Feed",
    buyer: "creators/newsletters",
    monthly_price_cents: 29900,
    public_fields_only: true,
  },
  {
    package: "Publisher Embed",
    buyer: "publishers/media",
    monthly_price_cents: 79900,
    public_fields_only: true,
  },
  {
    package: "Signal Partner",
    buyer: "B2B/API partners",
    monthly_price_cents: 150000,
    public_fields_only: true,
  },
];

export function siteBaseUrl() {
  return (
    process.env.SHARPSIGNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
}

export async function buildPublicApiPayload(): Promise<PublicApiPayload> {
  const seoPages = await loadSeoPages();
  const publicAudited = await loadPublicAuditedPerformance();
  return {
    generated_at: new Date().toISOString(),
    schema: "sharpssignal_public_v1",
    disclaimer:
      "Public API/export contains audited aggregate performance and matchup metadata only. Paid pick details are excluded.",
    sports: {
      public_audited: publicAudited,
    },
    seo_pages: seoPages,
    b2b_packages: B2B_PACKAGES,
  };
}

export async function loadSeoPages(): Promise<SeoPage[]> {
  if (!hasSupabaseServiceConfig()) return [];
  const supabase = createSupabaseServiceClient();
  const baseUrl = siteBaseUrl();

  const fromSeoPages = await supabase
    .from("seo_pages")
    .select("sport,away_team,home_team,game_date,slug,title,description,canonical_url,updated_at,status")
    .eq("status", "ready")
    .order("game_date", { ascending: false })
    .limit(500);

  if (!fromSeoPages.error && fromSeoPages.data?.length) {
    return fromSeoPages.data.map((row: any) => ({
      sport: text(row.sport),
      away_team: text(row.away_team),
      home_team: text(row.home_team),
      game_date: text(row.game_date).slice(0, 10),
      slug: text(row.slug),
      title: text(row.title),
      description: text(row.description),
      canonical_url: text(row.canonical_url) || `${baseUrl}/mlb/${text(row.slug)}`,
      updated_at: row.updated_at || null,
    }));
  }

  const fallback = await supabase
    .from("picks")
    .select("sport,away_team,home_team,market,game_time,observed_at,updated_at")
    .eq("sport", "baseball_mlb")
    .order("observed_at", { ascending: false })
    .limit(200);

  if (fallback.error || !fallback.data?.length) return [];

  const bySlug = new Map<string, SeoPage>();
  for (const row of fallback.data as any[]) {
    const page = seoPageFromRow(row, baseUrl);
    if (page && !bySlug.has(page.slug)) bySlug.set(page.slug, page);
  }
  return Array.from(bySlug.values()).slice(0, 100);
}

export async function loadSeoPage(slug: string): Promise<SeoPage | null> {
  const pages = await loadSeoPages();
  return pages.find((page) => page.slug === slug) || null;
}

async function loadPublicAuditedPerformance() {
  const empty = {
    kpis: { closed: 0, wins: 0, pnl: 0, staked: 0, roi: null, avg_clv_pct: null },
    leaderboard: [],
  };
  if (!hasSupabaseServiceConfig()) return empty;
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("bets")
    .select("sport,market,setup,tier_code,result,pnl,stake,clv_pct,closing_decimal,official,status")
    .eq("official", true)
    .eq("status", "closed")
    .not("closing_decimal", "is", null)
    .not("clv_pct", "is", null)
    .limit(5000);

  if (error || !data?.length) return empty;

  let closed = 0;
  let wins = 0;
  let pnl = 0;
  let staked = 0;
  let clvTotal = 0;
  let clvCount = 0;
  const groups = new Map<string, any>();

  for (const row of data as any[]) {
    closed += 1;
    const result = text(row.result).toLowerCase();
    if (result === "win" || result === "won") wins += 1;
    const rowPnl = number(row.pnl) || 0;
    const stake = number(row.stake) || 0;
    const clv = number(row.clv_pct);
    pnl += rowPnl;
    staked += stake;
    if (clv != null) {
      clvTotal += clv;
      clvCount += 1;
    }

    const key = [row.sport, row.market, row.setup, row.tier_code].map(text).join("|");
    const group = groups.get(key) || {
      sport: text(row.sport),
      market: text(row.market),
      setup: text(row.setup),
      tier_code: text(row.tier_code),
      closed: 0,
      wins: 0,
      pnl: 0,
      staked: 0,
      clv_total: 0,
      clv_count: 0,
    };
    group.closed += 1;
    group.wins += result === "win" || result === "won" ? 1 : 0;
    group.pnl += rowPnl;
    group.staked += stake;
    if (clv != null) {
      group.clv_total += clv;
      group.clv_count += 1;
    }
    groups.set(key, group);
  }

  const leaderboard = Array.from(groups.values())
    .map((group) => ({
      sport: group.sport,
      market: group.market,
      setup: group.setup,
      tier_code: group.tier_code,
      closed: group.closed,
      wins: group.wins,
      pnl: round(group.pnl),
      staked: round(group.staked),
      roi: group.staked ? group.pnl / group.staked : null,
      avg_clv_pct: group.clv_count ? group.clv_total / group.clv_count : null,
    }))
    .sort((a, b) => Number(b.closed) - Number(a.closed))
    .slice(0, 100);

  return {
    kpis: {
      closed,
      wins,
      pnl: round(pnl),
      staked: round(staked),
      roi: staked ? pnl / staked : null,
      avg_clv_pct: clvCount ? clvTotal / clvCount : null,
    },
    leaderboard,
  };
}

function seoPageFromRow(row: any, baseUrl: string): SeoPage | null {
  const away = text(row.away_team);
  const home = text(row.home_team);
  const gameDate = datePart(row.game_time) || datePart(row.observed_at);
  if (!away || !home || !gameDate) return null;
  const slug = `${slugify(away)}-vs-${slugify(home)}-${gameDate}`;
  return {
    sport: "baseball_mlb",
    away_team: away,
    home_team: home,
    game_date: gameDate,
    slug,
    title: `${away} vs ${home} odds context, ${gameDate}`,
    description: `Free MLB matchup context for ${away} vs ${home} on ${gameDate}: audited performance context, market types covered, and responsible betting notes.`,
    canonical_url: `${baseUrl}/mlb/${slug}`,
    updated_at: row.updated_at || row.observed_at || null,
  };
}

export function sitemapXml(pages: SeoPage[]) {
  const baseUrl = siteBaseUrl();
  const staticPaths = ["", "/picks-preview", "/about", "/subscribe", "/contact", "/legal"];
  const urls = [
    ...staticPaths.map((path) => ({ loc: `${baseUrl}${path}`, lastmod: null as string | null })),
    ...pages.map((page) => ({ loc: page.canonical_url, lastmod: page.updated_at || page.game_date })),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, lastmod }) => {
      const lastmodTag = lastmod ? `<lastmod>${escapeXml(datePart(lastmod) || lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(loc)}</loc>${lastmodTag}</url>`;
    }),
    "</urlset>",
    "",
  ].join("\n");
}

export function robotsTxt() {
  const baseUrl = siteBaseUrl();
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

function slugify(value: string) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function datePart(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function text(value: unknown) {
  return String(value || "").trim();
}

function number(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
