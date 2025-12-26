// pages/api/model-metrics.js
import Papa from "papaparse";
import { getObjectText, getDataObjectText, listDataObjects } from "../../lib/s3Client";


export default async function handler(req, res) {
	
  console.log("[api/model-metrics] BUILD = fallback-v1");
  console.log("[api/model-metrics] typeof listDataObjects =", typeof listDataObjects);
  try {
    const basePrefix = "alpha_signal_engine/models/";

    let modelCard = null;
    let tierConfig = null;
    let weeklyMetrics = [];

    // ----- Model card + tier config + weekly metrics (model bucket) -----
    try {
      const [modelCardRaw, tierConfigRaw, weeklyRaw] = await Promise.all([
        getObjectText(basePrefix + "model_card.json"),
        getObjectText(basePrefix + "tier_config.json"),
        getObjectText(basePrefix + "weekly_metrics.csv"),
      ]);

      modelCard = JSON.parse(modelCardRaw);
      tierConfig = JSON.parse(tierConfigRaw);

      const weeklyParsed = Papa.parse(weeklyRaw, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      weeklyMetrics = (weeklyParsed.data || [])
        .filter((row) => row.week != null)
        .map((row) => ({
          week: row.week,
          accuracy: row.accuracy ?? row.win_rate ?? 0,
          auc: row.auc ?? null,
          volume: row.n ?? row.count ?? null,
        }));
    } catch (err) {
      console.error("[api/model-metrics] failed to load model-card assets", err);
    }

	// ----- Daily evaluation metrics (data bucket: sharpsignal-ml-data) -----
	let dailyEval = null;

	try {
	  const TZ = process.env.TZ || "America/New_York";

	  const etTodayStr = () => {
		const parts = new Intl.DateTimeFormat("en-CA", {
		  timeZone: TZ,
		  year: "numeric",
		  month: "2-digit",
		  day: "2-digit",
		}).formatToParts(new Date());

		const y = parts.find((p) => p.type === "year").value;
		const m = parts.find((p) => p.type === "month").value;
		const d = parts.find((p) => p.type === "day").value;
		return `${y}-${m}-${d}`; // YYYY-MM-DD
	  };

	  const shiftDateStr = (yyyyMmDd, offsetDays) => {
		const [y, m, d] = yyyyMmDd.split("-").map(Number);
		const dt = new Date(Date.UTC(y, m - 1, d));
		dt.setUTCDate(dt.getUTCDate() + offsetDays);
		const yy = dt.getUTCFullYear();
		const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
		const dd = String(dt.getUTCDate()).padStart(2, "0");
		return `${yy}-${mm}-${dd}`;
	  };

	  const base = etTodayStr();
	  const attempts = [0, -1].map((offset) => {
		const dateStr = shiftDateStr(base, offset);
		const ymd = dateStr.replace(/-/g, "");
		return {
		  dateStr,
		  key: `metrics/daily/date=${dateStr}/evaluation_${ymd}.json`,
		};
	  });

	  const parseEval = (evalJson, fallbackDateStr) => ({
		date: evalJson.date || fallbackDateStr,
		nBets: evalJson.totals?.n_bets ?? null,
		roi: evalJson.totals?.roi ?? null,
		winRate: evalJson.totals?.win_rate ?? null,
		totalProfit: evalJson.totals?.total_profit ?? null,
		totalStaked: evalJson.totals?.total_staked ?? null,
	  });

	  for (const { dateStr, key } of attempts) {
		try {
		  console.log("[api/model-metrics] trying daily eval key", key);
		  const evalRaw = await getDataObjectText(key);
		  const evalSafe = evalRaw.replace(/\bNaN\b/g, "null");
		  const evalJson = JSON.parse(evalSafe);
		  dailyEval = parseEval(evalJson, dateStr);
		  break;
		} catch (err) {
		  if (err?.Code === "NoSuchKey" || err?.name === "NoSuchKey") {
			console.warn("[api/model-metrics] no daily eval at", key);
			continue;
		  }
		  throw err;
		}
	  }

	  // Fallback: load the latest evaluation_*.json in S3 if today/yesterday not found
	  if (!dailyEval) {
		console.log("[api/model-metrics] falling back to latest evaluation_*.json under metrics/daily/");
		
		const objs = await listDataObjects("metrics/daily/");
		console.log("[api/model-metrics] fallback objs count =", objs?.length);

		const evalObjs = objs
		  .filter((o) => o?.Key && o.Key.includes("/evaluation_") && o.Key.endsWith(".json"))
		  .sort((a, b) => new Date(b.LastModified).getTime() - new Date(a.LastModified).getTime());

		const latest = evalObjs[0];

		if (latest?.Key) {
		  console.log("[api/model-metrics] latest eval key:", latest.Key, "LastModified:", latest.LastModified);
		  const evalRaw = await getDataObjectText(latest.Key);
		  const evalSafe = evalRaw.replace(/\bNaN\b/g, "null");
		  const evalJson = JSON.parse(evalSafe);

		  // Try to infer date from the key: .../date=YYYY-MM-DD/evaluation_YYYYMMDD.json
		  const m = latest.Key.match(/date=(\d{4}-\d{2}-\d{2})\/evaluation_(\d{8})\.json$/);
		  const inferredDate = m?.[1] || null;

		  dailyEval = parseEval(evalJson, inferredDate || base);
		} else {
		  console.warn("[api/model-metrics] no evaluation jsons found under metrics/daily/");
		}
	  }
	} catch (err) {
	  console.error("[api/model-metrics] failed to load daily evaluation", err);
	}


    // Always return 200 with whatever we have
    res.status(200).json({
	  _build: "fallback-v1",
      modelCard,
      tierConfig,
      weeklyMetrics,
      dailyEval,
    });
  } catch (err) {
    console.error("[api/model-metrics] outer error:", err);
    res.status(500).json({ error: "Failed to load model metrics" });
  }
}
