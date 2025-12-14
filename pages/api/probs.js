// pages/api/probs.js
export default async function handler(req, res) {
  try {
    const betIds = String(req.query.bet_ids || "").trim();
    if (!betIds) return res.status(200).json({ probs: {} });

    const base = process.env.ML_API_BASE; // e.g. http://localhost:8000  (NO trailing /)
    if (!base) return res.status(500).json({ error: "Missing env ML_API_BASE" });

    // tolerate users setting ML_API_BASE with or without /api
    const normalized = base.replace(/\/+$/, "");
    const url = `${/\/api$/.test(normalized) ? normalized : normalized + "/api"}/probs?bet_ids=${encodeURIComponent(betIds)}`;

    const headers = {};
    if (process.env.ML_API_TOKEN) headers["x-api-key"] = process.env.ML_API_TOKEN;

    const r = await fetch(url, { headers });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `Upstream ML error: ${text}` });

    const data = JSON.parse(text);              // { probs: { "<bet_id>": number } }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || "unknown error" });
  }
}
