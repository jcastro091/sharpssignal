import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.write(JSON.stringify({
    ok: true,
    product: "SharpsSignal",
    engines: ["sports", "markets"],
    evidence_status: "research_and_paper_validation",
    verification: "private",
    public_disclosure: "aggregate_attestation_only",
    profitability_claim: false,
  }, null, 2));
  res.end();
  return { props: {} };
};

export default function PublicApiJson() { return null; }
