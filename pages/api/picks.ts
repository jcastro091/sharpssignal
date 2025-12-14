// pages/api/picks.ts
// S3-backed pick helpers + API handler.
//
// - Latest daily all_observations_YYYYMMDD.csv lives under:
//   s3://<BUCKET>/raw/all_observations/date=YYYY-MM-DD/all_observations_YYYYMMDD.csv
//
// Exposed helpers:
//   - findHistoricalPick({ dateHint })  -> used by /api/assistant
//   - getPickForQuery(q)               -> used by /api/picks?q=...
//
// API:
//   - GET /api/picks?source=observations        -> latest all_observations rows
//   - GET /api/picks?q=what+was+yesterday%27s+pick

import type { NextApiRequest, NextApiResponse } from "next";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { parse } from "csv-parse/sync";
import { Readable } from "stream";
import { DateTime } from "luxon";

/* =========================
   Config
   ========================= */

const TZ = process.env.TZ || "America/New_York";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const BUCKET = process.env.SS_DATA_BUCKET || "sharpsignal-ml-data";
const OBS_PREFIX = process.env.SS_OBS_PREFIX || "raw/all_observations/";

/* =========================
   Shared helpers
   ========================= */

type CsvRow = Record<string, string>;

const pickCache = new Map<string, CsvRow[]>();

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

async function streamToString(stream: any): Promise<string> {
  if (typeof stream === "string") return stream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Resolve "yesterday", explicit YYYY-MM-DD, etc. into date keys.
 */
function resolveDateHint(dateHint: string): { dash: string; ymd: string } {
  const s = dateHint.toLowerCase();

  let offsetDays = 0;
  if (s.includes("yesterday") || s.includes("last night")) {
    offsetDays = 1;
  } else if (s.includes("two days ago") || s.includes("2 days ago")) {
    offsetDays = 2;
  } else if (s.includes("three days ago") || s.includes("3 days ago")) {
    offsetDays = 3;
  }

  const explicit = s.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  let baseDate: Date;
  if (explicit) {
    const y = Number(explicit[1]);
    const m = Number(explicit[2]);
    const d = Number(explicit[3]);
    baseDate = new Date(Date.UTC(y, m - 1, d));
  } else {
    baseDate = new Date();
  }

  const d = new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate()
    )
  );
  d.setUTCDate(d.getUTCDate() - offsetDays);

  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  const dash = `${y}-${pad2(m)}-${pad2(day)}`; // 2025-12-11
  const ymd = `${y}${pad2(m)}${pad2(day)}`; // 20251211

  return { dash, ymd };
}

/**
 * Load all_observations_YYYYMMDD.csv for a given date key.
 */
async function loadObservationsForDateKey(
  dash: string,
  ymd: string,
  nocache = false
): Promise<CsvRow[]> {
  const cacheKey = `${dash}-${ymd}`;
  if (!nocache && pickCache.has(cacheKey)) {
    return pickCache.get(cacheKey)!;
  }

  const key = `${OBS_PREFIX}date=${dash}/all_observations_${ymd}.csv`;

  console.log("[picks/s3] loading", { bucket: BUCKET, key });

  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );

  const csvText = await streamToString(obj.Body as any);

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];

  pickCache.set(cacheKey, records);
  return records;
}

/**
 * Load the latest all_observations_YYYYMMDD.csv under OBS_PREFIX.
 * Used by /api/picks?source=observations.
 */
async function loadLatestObservationsFromS3(): Promise<CsvRow[]> {
  console.log("[/api/picks] OBS S3 listing", { bucket: BUCKET, prefix: OBS_PREFIX });

  const listResp = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: OBS_PREFIX,
      MaxKeys: 200,
    })
  );

  const contents = listResp.Contents || [];
  const csvObjects = contents.filter(
    (obj) => obj.Key && obj.Key.endsWith(".csv")
  );
  if (!csvObjects.length) {
    throw new Error(`No CSV objects found under prefix ${OBS_PREFIX}`);
  }

  const latest = csvObjects.reduce((a, b) =>
    !a || (b.LastModified && (!a.LastModified || b.LastModified > a.LastModified))
      ? b
      : a
  );

  console.log(
    "[/api/picks] OBS latest key:",
    latest.Key,
    "LastModified:",
    latest.LastModified
  );

  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: latest.Key!,
    })
  );

  const csvText = await streamToString(obj.Body as any);
  console.log("[/api/picks] OBS csv length:", csvText.length);

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];

  console.log("[/api/picks] OBS rows:", records.length);
  return records;
}

/* =========================
   Pick mapping
   ========================= */

export type HistoricalPick = {
  matchup: string; // "Away @ Home"
  pick?: string;
  line?: number | string | null;
  american_odds?: number | string | null;
  ev_percent?: number | null;
  kelly_pct?: number | null;
  reason?: string;
  movement?: string;
  sport?: string;
  startTimeISO?: string;
  pro?: boolean;
};

function isPickRow(row: CsvRow): boolean {
  const tierCode = (row["Tier Code"] || "").trim().toUpperCase();
  if (["A", "B", "C"].includes(tierCode)) return true;

  const tierLabel = (row["Tier Label"] || "").toLowerCase();
  if (tierLabel && tierLabel.includes("tier") && !tierLabel.includes("pass")) {
    return true;
  }

  const stake = parseFloat(row["Stake Amount"] || "0");
  if (!Number.isNaN(stake) && stake > 0) return true;

  return false;
}

function rowToHistoricalPick(row: CsvRow): HistoricalPick {
  const sport = row["Sport"];
  const away = row["Away"];
  const home = row["Home"];
  const market = row["Market"] || "";
  const movement = row["Movement"] || "";
  const reason = row["Reason Text"] || "";
  const edgeRaw = row["Edge"];
  const edge = edgeRaw != null && edgeRaw !== "" ? Number(edgeRaw) : null;

  let americanOdds: number | null = null;
  for (const col of [
    "American Odds",
    "Odds (Am)",
    "LowVig Home Odds (Am)",
    "LowVig Away Odds (Am)",
  ]) {
    const v = row[col];
    if (v != null && v !== "" && !Number.isNaN(Number(v))) {
      americanOdds = Number(v);
      break;
    }
  }

  let pickStr: string | undefined;
  let line: number | string | null = null;

  const m = market.toLowerCase();
  if (m.startsWith("h2h")) {
    const isHome = m.includes("home");
    const team = isHome ? home : away;
    pickStr = `${team} ML`;
  } else if (m.startsWith("spread")) {
    const isHome = m.includes("home");
    const team = isHome ? home : away;
    const col = isHome ? "Spread Line Home" : "Spread Line Away";
    const lineRaw = row[col];
    if (lineRaw != null && lineRaw !== "" && !Number.isNaN(Number(lineRaw))) {
      line = Number(lineRaw);
      pickStr = `${team} ${line}`;
    } else {
      pickStr = `${team} spread`;
    }
  } else if (m.startsWith("total") || m.includes("over") || m.includes("under")) {
    const totalRaw = row["Total Line"];
    const side = m.includes("over") ? "Over" : m.includes("under") ? "Under" : "Total";
    if (totalRaw != null && totalRaw !== "" && !Number.isNaN(Number(totalRaw))) {
      line = Number(totalRaw);
      pickStr = `${side} ${line}`;
    } else {
      pickStr = side;
    }
  }

  const startTimeISO = row["Game Time"] || row["Timestamp"] || undefined;
  const tierCode = (row["Tier Code"] || "").trim().toUpperCase();
  const pro = tierCode === "A" || tierCode === "B";

  return {
    matchup: `${away} @ ${home}`,
    pick: pickStr,
    line,
    american_odds: americanOdds,
    ev_percent: edge != null ? edge * 100 : null,
    kelly_pct: null,
    reason,
    movement,
    sport,
    startTimeISO,
    pro,
  };
}

/* =========================
   Public S3 helpers
   ========================= */

export async function findHistoricalPick(args: {
  dateHint: string;
  nocache?: boolean;
}): Promise<HistoricalPick | null> {
  const { dateHint, nocache } = args;
  const { dash, ymd } = resolveDateHint(dateHint);

  try {
    const rows = await loadObservationsForDateKey(dash, ymd, !!nocache);

    const pickRows = rows.filter(isPickRow);
    if (!pickRows.length) {
      console.log("[picks/s3] no pick rows for", { dash, ymd });
      return null;
    }

    pickRows.sort((a, b) => {
      const ta = new Date(a["Timestamp"] || a["Game Time"] || "").getTime();
      const tb = new Date(b["Timestamp"] || b["Game Time"] || "").getTime();
      return ta - tb;
    });

    const latest = pickRows[pickRows.length - 1];
    return rowToHistoricalPick(latest);
  } catch (err) {
    console.error("[picks/s3] error loading historical pick", { dateHint, dash, ymd, err });
    throw err;
  }
}

export async function getPickForQuery(q: string): Promise<HistoricalPick | null> {
  const s = q.toLowerCase();
  const hint =
    s.includes("yesterday") || s.includes("last night") ? "yesterday" : "today";
  return findHistoricalPick({ dateHint: hint, nocache: false });
}

/* =========================
   API handler
   ========================= */

type ApiResponse =
  | { ok: true; rows: CsvRow[] }
  | { ok: true; result: HistoricalPick | null }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const nocache =
      req.query.nocache === "1" || req.query.nocache === "true";
    const source = String(req.query.source || "").toLowerCase();
    console.log("[/api/picks] query.source =", source || "<none>");

    // 1) Observations branch (used by dashboard / assistant context)
    if (["observations", "allobservations", "obs"].includes(source)) {
      console.log("[/api/picks] OBS branch ENTER");
      const rows = await loadLatestObservationsFromS3();
      return res.status(200).json({ ok: true, rows });
    }

    // 2) Default = single-pick lookup backed by S3
    const q = req.query.q ? String(req.query.q) : "";
    const result = await getPickForQuery(q || "today");
    return res.status(200).json({ ok: true, result });
  } catch (err: any) {
    console.error("[/api/picks] error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}
