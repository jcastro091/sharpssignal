// pages/api/model-metrics.js
import Papa from "papaparse";
import { getObjectText, getDataObjectText } from "../../lib/s3Client";

export default async function handler(req, res) {
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
    // ----- Daily evaluation metrics (data bucket: sharpsignal-ml-data) -----
    let dailyEval = null;
    try {
      // Yesterday, to match metrics/daily/date=YYYY-MM-DD/...
      const now = new Date();
      const evalDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateStr = evalDate.toISOString().slice(0, 10); // "2025-12-09"
      const ymd = dateStr.replace(/-/g, "");               // "20251209"

      const evalKey = `metrics/daily/date=${dateStr}/evaluation_${ymd}.json`;
      const evalRaw = await getDataObjectText(evalKey);

      // <<< THIS IS THE IMPORTANT FIX >>>
      // Your evaluation JSON has NaN values (Python-style) which are invalid in JSON.
      // Replace bare NaN tokens with null before parsing.
      const evalSafe = evalRaw.replace(/\bNaN\b/g, "null");
      const evalJson = JSON.parse(evalSafe);

      dailyEval = {
        date: evalJson.date || dateStr,
        nBets: evalJson.totals?.n_bets ?? null,
        roi: evalJson.totals?.roi ?? null,          // 0.5266 = 52.66%
        winRate: evalJson.totals?.win_rate ?? null, // 0.4435 = 44.35%
        totalProfit: evalJson.totals?.total_profit ?? null,
        totalStaked: evalJson.totals?.total_staked ?? null,
      };
    } catch (err) {
      console.error("[api/model-metrics] failed to load daily evaluation", err);
    }


    // Always return 200 with whatever we have
    res.status(200).json({
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
