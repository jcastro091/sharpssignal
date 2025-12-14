// lib/personalize.ts
import { americanToDecimal } from "./odds";

export function kellyFraction(p: number, decimalOdds: number) {
  const b = decimalOdds - 1;
  if (b <= 0) return 0;
  return Math.max(0, (b*p - (1-p)) / b);
}

export function sizedStake(p: number, american: number) {
  const bankroll = Number(process.env.DEFAULT_BANKROLL || 1000);
  const kScale = Number(process.env.DEFAULT_KELLY_FRACTION || 0.5);
  const maxPct = Number(process.env.MAX_STAKE_PCT || 0.02);
  const dec = americanToDecimal(american);
  const kFull = kellyFraction(p, dec);
  const kScaled = kFull * kScale;
  const stake = bankroll * Math.min(maxPct, Math.max(0, kScaled));
  return Math.round(stake * 100) / 100;
}
