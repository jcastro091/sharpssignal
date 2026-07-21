const SPORTS_API_BASE = String(
  process.env.SHARPS_SIGNAL_SPORTS_API_URL ||
    "https://sharpssignal-sports-api.vercel.app"
).replace(/\/$/, "");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const upstreamUrl = new URL("/api/proof-report", SPORTS_API_BASE);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) value.forEach((item) => upstreamUrl.searchParams.append(key, item));
      else if (value !== undefined) upstreamUrl.searchParams.set(key, String(value));
    }

    const upstream = await fetch(upstreamUrl, {
      headers: { accept: req.headers.accept || "text/html,application/json" },
      cache: "no-store",
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") || "text/html; charset=utf-8");
    res.setHeader("cache-control", upstream.headers.get("cache-control") || "private, no-store");
    return res.send(body);
  } catch (error) {
    console.error("[/api/proof-report] v3 proxy error:", error?.message || error);
    return res.status(502).json({ ok: false, error: "sports_api_unavailable" });
  }
}
