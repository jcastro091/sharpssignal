// lib/truai/registry.ts

export type TruAICertStatus =
  | "AI-Data Safe Certified"
  | "AI-Data Safe — Conditional"
  | "Not Certified";

export type TruAIRegistryRecord = {
  domain: string;                 // canonical, lowercase
  product: string;
  badge: TruAICertStatus;
  risk_score: number;             // 0-100
  issued_at_utc: string;          // ISO8601
  checks_run: string[];
  report_hash_sha256: string;     // lowercase hex
  artifact_url: string;           // where truai.json is hosted
  badge_svg_url: string;          // where svg badge lives
  notes?: string[];
};

const CANONICAL = (d: string) =>
  d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/**
 * v1 registry stored in code.
 * Later: move to DB (Supabase/Postgres) with an admin UI.
 */
export const REGISTRY: TruAIRegistryRecord[] = [
  {
    domain: "sharps-signal.com",
    product: "SharpSignal",
    badge: "AI-Data Safe Certified",
    risk_score: 12,
    // Update this to match your scan time (optional)
    issued_at_utc: "2026-01-02T03:05:01Z",
    checks_run: ["secrets", "logging", "retention", "third_party"],
    // Paste your PowerShell SHA256 here (lowercase)
    report_hash_sha256: "REPLACE_WITH_YOUR_SHA256",
    artifact_url: "https://sharps-signal.com/.well-known/truai.json",
    badge_svg_url: "https://sharps-signal.com/badges/truai-certified.svg",
    notes: [
      "Verification is backed by issuer registry + published artifact.",
      "Certification based on static analysis and heuristic checks."
    ]
  }
];

export function findRecord(domainInput?: string): TruAIRegistryRecord | null {
  const target = domainInput ? CANONICAL(domainInput) : "sharps-signal.com";
  const found = REGISTRY.find(r => CANONICAL(r.domain) === target);
  return found ?? null;
}
