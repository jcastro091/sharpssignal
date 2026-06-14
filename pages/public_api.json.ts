import { GetServerSideProps } from "next";
import { buildPublicApiPayload } from "../lib/publicGrowth";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const payload = await buildPublicApiPayload();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.write(JSON.stringify(payload, null, 2));
  res.end();
  return { props: {} };
};

export default function PublicApiJson() {
  return null;
}
