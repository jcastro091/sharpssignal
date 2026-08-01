import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sharps-signal.com").replace(/\/$/, "");
  const paths = ["/", "/about", "/verification", "/subscribe", "/contact", "/legal"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${base}${path}</loc></url>`).join("")}</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function Sitemap() { return null; }
