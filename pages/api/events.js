import crypto from "crypto";
const { cleanEvent } = require("../../lib/measurement.cjs");
import {
  createSupabaseServiceClient,
  hasSupabaseServiceConfig,
} from "../../lib/supabaseServer";

function cleanText(value, max = 500) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  if (!hasSupabaseServiceConfig())
    return res
      .status(503)
      .json({ ok: false, persisted: false, reason: "analytics_unavailable" });

  const origin = req.headers.origin;
  if (
    !origin ||
    ![
      "https://www.sharps-signal.com",
      "https://sharps-signal.com",
      `https://${req.headers.host}`,
      ...(process.env.NODE_ENV === "development"
        ? [`http://${req.headers.host}`]
        : []),
    ].includes(origin)
  )
    return res.status(403).json({ ok: false });
  const safe = cleanEvent(req.body);
  if (!safe)
    return res.status(400).json({ ok: false, error: "unsupported_event" });
  const row = {
    ...safe,
    event_id: safe.event_id || "evt_" + crypto.randomUUID(),
  };

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await insertWithColumnFallback(
      supabase,
      "funnel_events",
      row,
    );
    if (error) {
      console.warn("[events] Supabase write failed:", error.message);
      return res
        .status(503)
        .json({ ok: false, persisted: false, reason: "write_failed" });
    }
    return res.status(200).json({ ok: true, persisted: true });
  } catch (error) {
    console.warn("[events]", error?.message || error);
    return res
      .status(503)
      .json({ ok: false, persisted: false, reason: "write_failed" });
  }
}

async function insertWithColumnFallback(supabase, table, row) {
  let payload = { ...row };
  let result = await supabase
    .from(table)
    .upsert(payload, { onConflict: "event_id", ignoreDuplicates: true });
  const removed = new Set();
  while (result.error) {
    const column = missingColumn(result.error.message);
    if (
      !column ||
      removed.has(column) ||
      !(column in payload) ||
      [
        "event_id",
        "metadata",
        "visitor_id",
        "session_id",
        "page_path",
      ].includes(column)
    )
      break;
    removed.add(column);
    payload = { ...payload };
    delete payload[column];
    result = await supabase
      .from(table)
      .upsert(payload, { onConflict: "event_id", ignoreDuplicates: true });
  }
  return result;
}

function missingColumn(message = "") {
  const match = String(message).match(
    /'([^']+)' column|column '([^']+)'|Could not find the '([^']+)'/i,
  );
  return match?.[1] || match?.[2] || match?.[3] || "";
}

function stableId(...parts) {
  const source = parts.map((part) => cleanText(part, 1000)).join("|");
  return `${cleanText(parts[0], 40) || "id"}_${crypto.createHash("sha256").update(source).digest("hex").slice(0, 20)}`;
}
