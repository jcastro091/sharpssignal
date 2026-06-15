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

export type AuditedBetRow = {
  observed_at: string;
  sport: string;
  market: string;
  setup: string;
  tier_code: string;
  result: string;
  pnl: number;
  stake: number;
  clv_pct: number | null;
};

export type WeeklyReport = {
  week_start: string;
  week_end: string;
  closed: number;
  wins: number;
  losses: number;
  pushes: number;
  pnl: number;
  staked: number;
  roi: number | null;
  win_rate: number | null;
  avg_clv_pct: number | null;
};

export type AuditedRecord = {
  generated_at: string;
  sample_status: {
    label: string;
    closed: number;
    next_threshold: number | null;
    message: string;
  };
  kpis: Record<string, number | null>;
  leaderboard: Array<Record<string, string | number | null>>;
  weekly_reports: WeeklyReport[];
  recent: AuditedBetRow[];
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

export async function loadAuditedRecord(): Promise<AuditedRecord> {
  const rows = await loadAuditedBetRows();
  const publicAudited = summarizeAuditedRows(rows);
  return {
    generated_at: new Date().toISOString(),
    sample_status: sampleStatus(Number(publicAudited.kpis.closed || 0)),
    kpis: publicAudited.kpis,
    leaderboard: publicAudited.leaderboard,
    weekly_reports: buildWeeklyReports(rows),
    recent: rows.slice(0, 50),
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
  const rows = await loadAuditedBetRows();
  return summarizeAuditedRows(rows);
}

async function loadAuditedBetRows(): Promise<AuditedBetRow[]> {
  if (!hasSupabaseServiceConfig()) return [];
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("bets")
    .select("observed_at,sport,market,setup,tier_code,result,pnl,stake,clv_pct,closing_decimal,official,status")
    .eq("official", true)
    .eq("status", "closed")
    .not("closing_decimal", "is", null)
    .not("clv_pct", "is", null)
    .order("observed_at", { ascending: false })
    .limit(5000);

  if (error || !data?.length) return [];

  return (data as any[]).map((row) => ({
    observed_at: text(row.observed_at),
    sport: text(row.sport),
    market: text(row.market),
    setup: text(row.setup),
    tier_code: text(row.tier_code),
    result: normalizeResult(row.result),
    pnl: number(row.pnl) || 0,
    stake: number(row.stake) || 0,
    clv_pct: number(row.clv_pct),
  }));
}

function summarizeAuditedRows(rows: AuditedBetRow[]) {
  const empty = {
    kpis: { closed: 0, wins: 0, pnl: 0, staked: 0, roi: null, avg_clv_pct: null },
    leaderboard: [],
  };
  if (!rows.length) return empty;

  let closed = 0;
  let wins = 0;
  let pnl = 0;
  let staked = 0;
  let clvTotal = 0;
  let clvCount = 0;
  const groups = new Map<string, any>();

  for (const row of rows) {
    closed += 1;
    const result = normalizeResult(row.result);
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

function buildWeeklyReports(rows: AuditedBetRow[]): WeeklyReport[] {
  const groups = new Map<string, AuditedBetRow[]>();
  for (const row of rows) {
    const week = weekStart(row.observed_at);
    if (!week) continue;
    groups.set(week, [...(groups.get(week) || []), row]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week_start, weekRows]) => {
      const summary = summarizeWeek(weekRows);
      return {
        week_start,
        week_end: addDays(week_start, 6),
        ...summary,
      };
    })
    .slice(0, 26);
}

function summarizeWeek(rows: AuditedBetRow[]) {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let pnl = 0;
  let staked = 0;
  let clvTotal = 0;
  let clvCount = 0;
  for (const row of rows) {
    const result = normalizeResult(row.result);
    if (result === "win") wins += 1;
    else if (result === "loss") losses += 1;
    else if (result === "push") pushes += 1;
    pnl += row.pnl || 0;
    staked += row.stake || 0;
    if (row.clv_pct != null) {
      clvTotal += row.clv_pct;
      clvCount += 1;
    }
  }
  const closed = rows.length;
  return {
    closed,
    wins,
    losses,
    pushes,
    pnl: round(pnl),
    staked: round(staked),
    roi: staked ? pnl / staked : null,
    win_rate: closed ? wins / closed : null,
    avg_clv_pct: clvCount ? clvTotal / clvCount : null,
  };
}

function sampleStatus(closed: number) {
  if (closed < 25) {
    return {
      label: "collecting",
      closed,
      next_threshold: 25,
      message: "We are still proving the logging and grading loop. Treat results as operational telemetry, not a betting edge.",
    };
  }
  if (closed < 100) {
    return {
      label: "early",
      closed,
      next_threshold: 100,
      message: "Early signal only. CLV and grading completeness matter more than ROI at this sample size.",
    };
  }
  if (closed < 250) {
    return {
      label: "reviewable",
      closed,
      next_threshold: 250,
      message: "Enough to review thresholds and market segments, still not enough for aggressive bankroll scaling.",
    };
  }
  return {
    label: "auditable",
    closed,
    next_threshold: null,
    message: "The record has enough volume for public weekly reporting and serious segment review.",
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
  const staticPaths = ["", "/picks-preview", "/record", "/reports/weekly", "/about", "/subscribe", "/contact", "/legal"];
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

function weekStart(value: unknown) {
  const raw = datePart(value);
  if (!raw) return "";
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeResult(value: unknown) {
  const raw = text(value).toLowerCase();
  if (["win", "won", "w", "1", "1.0"].includes(raw)) return "win";
  if (["loss", "lose", "lost", "l", "0", "0.0"].includes(raw)) return "loss";
  if (["push", "void", "cancelled", "canceled"].includes(raw)) return "push";
  return raw || "unknown";
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
