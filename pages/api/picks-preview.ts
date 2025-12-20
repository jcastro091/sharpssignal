// pages/api/picks-preview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { parse } from "csv-parse/sync";
import { Readable } from "stream";
import { DateTime } from "luxon";

const TZ = process.env.TZ || "America/New_York";
const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.SS_DATA_BUCKET || "sharpsignal-ml-data";
const OBS_PREFIX = process.env.SS_OBS_PREFIX || "raw/all_observations/";

type CsvRow = Record<string, string>;

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function ciGet(row: CsvRow, keys: string[]): string | undefined {
  const map: Record<string, string> = {};
  for (const k of Object.keys(row || {})) map[k.toLowerCase()] = row[k];
  for (const k of keys) {
    const v = map[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function parseRowDateTime(row: CsvRow): DateTime | null {
  const raw =
    ciGet(row, ["Timestamp", "Game Time", "Commence Time", "start_time", "ts_iso", "ts_local", "created_at"]) || "";

  const iso = normalizeTimestampToISO(raw);
  if (!iso) return null;

  const dt = DateTime.fromISO(iso, { setZone: true });
  return dt.isValid ? dt.setZone(TZ) : null;
}


function isPickRow(row: CsvRow): boolean {
  const tierCode = (row["Tier Code"] || "").trim().toUpperCase();
  if (["A", "B", "C"].includes(tierCode)) return true;

  const tierLabel = (row["Tier Label"] || "").toLowerCase();
  if (tierLabel && tierLabel.includes("tier") && !tierLabel.includes("pass")) return true;

  const stake = Number(row["Stake Amount"] || 0);
  if (Number.isFinite(stake) && stake > 0) return true;

  // fallback: if market exists and predicted side/team exists, treat it as pick-ish
  const market = (row["Market"] || "").trim();
  const pickish = (ciGet(row, ["Predicted", "Predicted Side", "Predicted Team", "Pick"]) || "").trim();

  if (market && pickish) return true;

  return false;
}



function outcomeFromRow(row: CsvRow): "win" | "loss" | "push" | null {
  const raw =
    ciGet(row, ["Prediction Result", "Result", "Outcome", "Grade", "Win/Loss", "win", "label"]) || "";
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  if (["win", "won", "w", "1", "true"].includes(s)) return "win";
  if (["loss", "lost", "l", "0", "false"].includes(s)) return "loss";
  if (["push", "p", "2", "void"].includes(s)) return "push";

  return null;
}

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const s = String(x).replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function americanOdds(row: CsvRow): number | null {
  return (
    toNum(ciGet(row, ["American Odds", "Odds (Am)", "odds", "price", "line"])) ??
    toNum(ciGet(row, ["LowVig Home Odds (Am)", "LowVig Away Odds (Am)"]))
  );
}

function stake(row: CsvRow): number {
  const s = toNum(ciGet(row, ["Stake Amount", "Stake", "Risk", "Units", "units"])) ?? 1;
  return s > 0 ? s : 1;
}

function pnlFromAmerican(odds: number, stakeAmt: number, outcome: "win" | "loss" | "push"): number {
  if (outcome === "push") return 0;
  if (outcome === "loss") return -stakeAmt;
  if (odds > 0) return stakeAmt * (odds / 100);
  return stakeAmt * (100 / Math.abs(odds));
}

async function loadLatestObs(): Promise<{ rows: CsvRow[]; lastModifiedISO: string | null; key: string }> {
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: OBS_PREFIX, MaxKeys: 500 })
  );

  const files = (list.Contents || [])
    .filter((o) => o.Key && o.Size && o.Size > 0 && o.Key.toLowerCase().endsWith(".csv"))
    .sort((a, b) => (b.LastModified?.getTime?.() ?? 0) - (a.LastModified?.getTime?.() ?? 0));

  if (!files.length) throw new Error(`No CSV found under s3://${BUCKET}/${OBS_PREFIX}`);

  const latest = files[0];
  const key = latest.Key!;
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const csvText = await streamToString(obj.Body as any);

  const rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true }) as CsvRow[];
  return { rows, lastModifiedISO: latest.LastModified ? latest.LastModified.toISOString() : null, key };
}

function normalizeTimestampToISO(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // SQL-style timestamp: "2025-08-13 13:01:29+00:00"
  let dt = DateTime.fromSQL(s, { setZone: true });
  if (dt.isValid) return dt.toUTC().toISO();

  // Explicit fallback
  dt = DateTime.fromFormat(s, "yyyy-MM-dd HH:mm:ssZZ", { setZone: true });
  if (dt.isValid) return dt.toUTC().toISO();

  // Final ISO attempt
  let normalized = s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  dt = DateTime.fromISO(normalized, { setZone: true });
  if (dt.isValid) return dt.toUTC().toISO();

  return null;
}


function rowToPreviewPick(row: CsvRow) {
  const sport = row["Sport"] || "";
  const away = row["Away"] || "";
  const home = row["Home"] || "";
  const market = row["Market"] || "";
  const tier = (row["Tier Code"] || "").trim().toUpperCase() || (row["Tier Label"] || "");

  // ✅ you have Predicted in headers — use it
  const pick = row["Predicted"] || row["Pick"] || row["Predicted Side"] || row["Predicted Team"] || "";

  const tsRaw = ciGet(row, ["Timestamp"]) || "";
  const timestampISO = normalizeTimestampToISO(tsRaw);

  const minutesToStartRaw = ciGet(row, ["MinutesToStart"]);
  const minutesToStart = minutesToStartRaw ? Number(minutesToStartRaw) : null;

  return {
    matchup: `${away} @ ${home}`.trim(),
    sport,
    market,
    pick,
    tier,
    minutesToStart,
    timestampRaw: tsRaw,
    timestampISO, // ✅ for sorting
    americanOdds: americanOdds(row),
  };
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const { rows, lastModifiedISO, key } = await loadLatestObs();

    const now = DateTime.now().setZone(TZ);
    const today = now.toISODate(); // YYYY-MM-DD
    const start7 = now.minus({ days: 7 }).startOf("day");

	const pickRows = rows.filter(isPickRow);

	const MAX_SHOW = 50;
 

	  
	const todayPicks = pickRows
	  .map((row) => {
		const dt = parseRowDateTime(row);
		return {
		  row,
		  dt,
		  ingest: ciGet(row, ["ingest_date"]) || "",
		};
	  })
	  .filter(({ dt, ingest }) => {
		// Prefer ingest_date (this is what your system actually means by "today")
		if (ingest === today) return true;

		// Fallback: real event date
		if (dt && dt.isValid) return dt.toISODate() === today;

		return false;
	  })
	  .map(({ row }) => rowToPreviewPick(row))
	  .sort((a, b) => {
		const ta = a.timestampISO ? Date.parse(a.timestampISO) : 0;
		const tb = b.timestampISO ? Date.parse(b.timestampISO) : 0;
		return tb - ta;
	  })
	  .slice(0, MAX_SHOW);




    // Stats last 7 days
    let wins = 0, losses = 0, profit = 0, staked = 0;

    for (const r of pickRows) {
      const dt = parseRowDateTime(r);
      if (!dt?.isValid) continue;
      if (dt < start7 || dt > now.endOf("day")) continue;

      const out = outcomeFromRow(r);
      if (!out || out === "push") continue;

      if (out === "win") wins++;
      if (out === "loss") losses++;

      const o = americanOdds(r);
      if (o == null) continue;

      const s = stake(r);
      profit += pnlFromAmerican(o, s, out);
      staked += s;
    }

    const graded = wins + losses;
    const winRatePct = graded ? (wins / graded) * 100 : 0;
    const roiPct = staked ? (profit / staked) * 100 : 0;

    // Debug mode: quickly see why counts are zero
    const debug = req.query.debug === "1";
    if (debug) {
      const headers = rows[0] ? Object.keys(rows[0]) : [];
      const sample = rows.slice(0, 3);
      const validDT = rows.filter((r) => parseRowDateTime(r)?.isValid).length;
      const todayDT = rows.filter((r) => parseRowDateTime(r)?.toISODate?.() === today).length;




      return res.status(200).json({
        ok: true,
        debug: true,
        bucket: BUCKET,
        key,
        headers,
        counts: {
          totalRows: rows.length,
          pickRows: pickRows.length,
          validDateTimeRows: validDT,
          todayDateTimeRows: todayDT,
          todayPicks: todayPicks.length,
          gradedLast7: graded,
        },
        sampleRows: sample,
      });
    }

    return res.status(200).json({
      ok: true,
      today,
      modelRunTimeISO: lastModifiedISO,
      statsLast7: {
        winRatePct: Number(winRatePct.toFixed(1)),
        roiPct: Number(roiPct.toFixed(1)),
        totalBets: graded,
      },
      todayPicks,
    });
  } catch (err: any) {
    console.error("[/api/picks-preview] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}
