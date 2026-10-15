import { customerFeedContext } from "../../lib/customerFeedServer";
export default async function (req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const { pick, books, region } = req.query;
  if (
    typeof pick !== "string" ||
    pick.length > 1000 ||
    typeof books !== "string" ||
    books.length > 100 ||
    region !== "NY"
  )
    return res.status(400).json({ ok: false });
  try {
    const ctx = await customerFeedContext(req, res, "sports");
    if (!ctx)
      return res
        .status(401)
        .json({ ok: false, error: "confirmed_account_required" });
    const query = new URLSearchParams({
      pick,
      books,
      region,
      ...(ctx.realtimeProducts.includes("sports")
        ? {}
        : { force_delayed: "1" }),
    });
    const origin =
      process.env.MEMBER_FEED_BACKEND_URL ||
      "https://sharpssignal-sports-backend.vercel.app";
    const response = await fetch(origin + "/api/member-prices?" + query, {
      headers: { Authorization: "Bearer " + ctx.token },
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!response.ok)
      return res
        .status(
          response.status === 401 || response.status === 403
            ? response.status
            : 503,
        )
        .json({ ok: false, error: "prices_unavailable" });
    return res.json(await response.json());
  } catch {
    return res.status(503).json({ ok: false, error: "prices_unavailable" });
  }
}
