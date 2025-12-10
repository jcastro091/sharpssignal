// pages/api/model-metrics.js
import Papa from "papaparse";
import { getObjectText } from "../../lib/s3Client";

export default async function handler(req, res) {
  try {
    // Adjust the paths if your prefix changes
    const basePrefix = "alpha_signal_engine/models/";

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

    // Normalize for charting: make sure we have a consistent x-axis key
    const weeklyMetrics = weekly.map((row) => ({
      week: row.week_start,                 // x-axis
      accuracy: row.accuracy * 100,        // 0.60 -> 60%
      auc: row.auc,
      volume: row.n,
    }));


    res.status(200).json({
      modelCard,
      tierConfig,
      weeklyMetrics,
    });
  } catch (err) {
    console.error("[api/model-metrics] error:", err);
    res.status(500).json({ error: "Failed to load model metrics" });
  }
}
