import { GetServerSideProps } from "next";
import { loadSeoPages, sitemapXml } from "../lib/publicGrowth";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const pages = await loadSeoPages();
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.write(sitemapXml(pages));
  res.end();
  return { props: {} };
};

export default function Sitemap() {
  return null;
}
