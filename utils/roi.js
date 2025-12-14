// utils/roi.js

export function calculateROI(picks = [], baseBankroll = 1000, stake = 100) {
  let bankroll = baseBankroll;
  let totalStaked = 0;
  let wins = 0;
  let losses = 0;

  const history = [];
  let peak = baseBankroll;
  let maxDrawdown = 0;

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const outcome = (pick["Prediction Result"] || "").toLowerCase();
    const odds = parseFloat(pick["Odds Taken"]) || 1.91;

    if (!["win", "lose"].includes(outcome)) continue;

    const profit = outcome === "win"
      ? stake * (odds - 1)
      : -stake;

    bankroll += profit;
    totalStaked += stake;

    if (outcome === "win") wins++;
    if (outcome === "lose") losses++;

    // Track drawdown
    if (bankroll > peak) peak = bankroll;
    const dd = peak - bankroll;
    if (dd > maxDrawdown) maxDrawdown = dd;

    history.push({
      date: pick["Timestamp"] || `Bet ${i + 1}`,
      bankroll: parseFloat(bankroll.toFixed(2)),
    });
  }

  const roiPercent = totalStaked > 0
    ? ((bankroll - baseBankroll) / totalStaked) * 100
    : 0;

  const winRate = (wins + losses) > 0
    ? (wins / (wins + losses)) * 100
    : 0;

  const profit = bankroll - baseBankroll;

  return {
    history,
    roiPercent: parseFloat(roiPercent.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    drawdown: parseFloat(maxDrawdown.toFixed(2)),
  };
}
