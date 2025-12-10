// pages/api/model-metrics.js
import Papa from "papaparse";
import { getObjectText, getDataObjectText } from "../../lib/s3Client";


export default async function handler(req, res) {
  try {
    const basePrefix =
      process.env.MODEL_METRICS_PREFIX || "models/prod/";

    const [modelCardRaw, tierConfigRaw, weeklyRaw] = await Promise.all([
      getObjectText(basePrefix + "model_card.json"),
      getObjectText(basePrefix + "tier_config.json"),
      getObjectText(basePrefix + "weekly_metrics.csv"),
    ]);

    const modelCard = JSON.parse(modelCardRaw);
    const tierConfig = JSON.parse(tierConfigRaw);

    const weekly = Papa.parse(weeklyRaw, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    }).data;

    const weeklyMetrics = weekly.map((row) => ({
      week: row.week_start,
      accuracy: row.accuracy * 100,
      auc: row.auc,
      volume: row.n,
    }));
	
	
    // ----- Daily evaluation metrics (from sharpsignal-ml-data) -----
    let dailyEval = null;
    try {
      // Use "yesterday" which matches your metrics/daily/date=YYYY-MM-DD path
      const now = new Date();
      const evalDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateStr = evalDate.toISOString().slice(0, 10); // "2025-12-09"
      const ymd = dateStr.replace(/-/g, "");               // "20251209"

      const evalKey = `metrics/daily/date=${dateStr}/evaluation_${ymd}.json`;
      const evalRaw = await getDataObjectText(evalKey);
      const evalJson = JSON.parse(evalRaw);

      dailyEval = {
        date: evalJson.date || dateStr,
        nBets: evalJson.totals?.n_bets ?? null,
        roi: evalJson.totals?.roi ?? null,           // e.g. 0.5266 = 52.66% ROI
        winRate: evalJson.totals?.win_rate ?? null,  // e.g. 0.4435 = 44.35%
        totalProfit: evalJson.totals?.total_profit ?? null,
        totalStaked: evalJson.totals?.total_staked ?? null,
      };
    } catch (e) {
      console.error("[api/model-metrics] failed to load daily evaluation", e);
    }
	
	

    return res.status(200).json({
      modelCard,
      tierConfig,
      weeklyMetrics,
	  dailyEval, 
    });
	
	
	
  } catch (err) {
    console.error("[api/model-metrics] error:", err);

    // 🔥 Dev fallback so your picks page still works even if S3/creds are borked
    if (process.env.NODE_ENV === "development") {
      return res.status(200).json({
        modelCard: {
          version: "dev-mock",
          trained_at: null,
          auc: 0.68,
        },
        tierConfig: {
          tiers: [
            { code: "A", label: "Tier A", min_proba: 0.65, max_proba: 1.0 },
            { code: "B", label: "Tier B", min_proba: 0.58, max_proba: 0.65 },
            { code: "C", label: "Tier C", min_proba: 0.52, max_proba: 0.58 },
          ],
        },
        weeklyMetrics: [],
      });
    }

    return res.status(500).json({ error: "Failed to load model metrics" });
  }
}
