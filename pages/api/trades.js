export default function handler(_req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(410).json({ ok: false, error: "public_trade_history_retired" });
}
