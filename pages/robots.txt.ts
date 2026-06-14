import { GetServerSideProps } from "next";
import { robotsTxt } from "../lib/publicGrowth";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.write(robotsTxt());
  res.end();
  return { props: {} };
};

export default function Robots() {
  return null;
}
