const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = "function detect5mCandlestickTrigger";
const endStr = "function scoreSrnAgainstOb";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newCode = `function detect5mCandlestickTrigger(k5: Candle[], zone: {low: number; high: number}, side: 'LONG' | 'SHORT'): TriggerResult {
  if (k5.length < 28) return { side: 'NONE', pattern: 'NO DATA', score: 0, valid: false, late: false, detail: '5M data belum cukup.' };
  
  const last = k5[k5.length - 1];
  const prev = k5[k5.length - 2];
  const prev2 = k5[k5.length - 3];
  const recent = k5.slice(-24, -1);
  const avgBody = recent.reduce((s, c) => s + candleBody(c), 0) / Math.max(1, recent.length);
  const avgVol = recent.reduce((s, c) => s + c.v, 0) / Math.max(1, recent.length);
  const body = candleBody(last);
  
  const inZoneNow = last.h >= Math.min(zone.low, zone.high) && last.l <= Math.max(zone.low, zone.high);
  const dist = distanceToZonePct(last.c, zone.low, zone.high);
  const late = dist > 0.70 && !inZoneNow;
  const volumeBoost = avgVol > 0 && last.v > avgVol * 1.2;
  const strongBody = body > avgBody * 1.45;

  const nowBull = last.c > last.o;
  const nowBear = last.c < last.o;

  const sweepLong = lowerWick(last) > body * 1.5 && last.l < prev.l && nowBull;
  const sweepShort = upperWick(last) > body * 1.5 && last.h > prev.h && nowBear;

  const displacementUp = nowBull && strongBody && last.c > prev.h;
  const displacementDown = nowBear && strongBody && last.c < prev.l;

  const fvgBullish = last.l > prev2.h && nowBull && strongBody;
  const fvgBearish = last.h < prev2.l && nowBear && strongBody;

  let pattern = 'NO TRIGGER';
  let score = 0;
  let valid = false;

  if (side === 'LONG') {
    if (sweepLong && fvgBullish) { pattern = 'Sniper: Sweep + FVG Bullish'; score = 35; valid = true; }
    else if (displacementUp && fvgBullish) { pattern = 'Displacement + FVG Bullish'; score = 25; valid = true; }
    else if (sweepLong) { pattern = 'Liquidity Sweep (Rejection)'; score = 18; valid = true; }
    else if (displacementUp) { pattern = 'Bullish Displacement (No FVG)'; score = 15; valid = true; }
  } else {
    if (sweepShort && fvgBearish) { pattern = 'Sniper: Sweep + FVG Bearish'; score = 35; valid = true; }
    else if (displacementDown && fvgBearish) { pattern = 'Displacement + FVG Bearish'; score = 25; valid = true; }
    else if (sweepShort) { pattern = 'Liquidity Sweep (Rejection)'; score = 18; valid = true; }
    else if (displacementDown) { pattern = 'Bearish Displacement (No FVG)'; score = 15; valid = true; }
  }

  if (valid && volumeBoost) score += 5;
  if (valid && !inZoneNow && dist > 0.45) score -= 8;
  if (late) score -= 18;

  const detail = valid
    ? \`\${pattern}\${volumeBoost ? ' + Vol Boost' : ''}\${late ? ' • LATE risk' : ''}\`
    : 'NO TRIGGER — tunggu Sweep / Displacement + FVG di zona.';

  return { side: valid ? side : 'NONE', pattern, score: clamp(score, 0, 40), valid, late, detail };
}

`;
  content = content.substring(0, startIndex) + newCode + content.substring(endIndex);
  fs.writeFileSync(file, content);
  console.log(">> LOGIKA FVG BERHASIL DISUNTIKKAN KE APP.TSX! <<");
} else {
  console.log(">> GAGAL MENCARI FUNGSI LAMA! <<");
}
