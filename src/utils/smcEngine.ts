import { Candle, Zone, OrderBlock, StructureSummary, StructurePoint, StructureEvent, TriggerResult } from '../types';
import { clamp, pctDistance, fmt } from './helpers';

export function detectSwings(candles: Candle[], lookback = 3) {
  const highs: { price: number; index: number; time: number }[] = [];
  const lows: { price: number; index: number; time: number }[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i]; let isHigh = true; let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isHigh = false;
      if (candles[j].l <= c.l) isLow = false;
    }
    if (isHigh) highs.push({ price: c.h, index: i, time: c.t });
    if (isLow) lows.push({ price: c.l, index: i, time: c.t });
  }
  return { highs: highs.slice(-22), lows: lows.slice(-22) };
}

function getSrnTolerance(tf: string, candles: Candle[]) {
  const last = candles[candles.length - 1]?.c || 0;
  const recent = candles.slice(-80);
  const avgRangePct = recent.length && last ? recent.reduce((s, c) => s + ((c.h - c.l) / Math.max(c.c, 1e-9)) * 100, 0) / recent.length : 0.3;
  const baseByTf: Record<string, number> = { '1m': 0.10, '5m': 0.16, '15m': 0.24, '1h': 0.38, '4h': 0.62, '1d': 1.10 };
  return clamp(Math.max(baseByTf[tf] ?? 0.28, avgRangePct * 0.55), 0.08, 1.35);
}

export function detectSrnZones(candles: Candle[], current: number, tolerancePct = 0.25, tf = '15m', kind: Zone['kind'] = 'ACTIVE') {
  if (!candles.length || !current) return { support: [] as Zone[], resistance: [] as Zone[] };
  const lookback = tf === '1m' || tf === '5m' ? 3 : tf === '15m' ? 4 : 5;
  const swings = detectSwings(candles, lookback);
  const adaptiveTolerance = Math.max(tolerancePct, getSrnTolerance(tf, candles));
  const recentStart = Math.max(0, candles.length - 160);
  const isBrokenSupport = (price: number, lastTime: number) => candles.filter(c => c.t > lastTime).slice(-50).some(c => c.c < price * (1 - adaptiveTolerance / 100 * 0.65));
  const isBrokenResistance = (price: number, lastTime: number) => candles.filter(c => c.t > lastTime).slice(-50).some(c => c.c > price * (1 + adaptiveTolerance / 100 * 0.65));
  const build = (points: { price: number; time: number; index?: number }[], side: 'support' | 'resistance') => {
    const zones: Zone[] = [];
    points.forEach((p: any) => {
      const hit = zones.find(z => Math.abs(pctDistance(z.price, p.price)) <= adaptiveTolerance);
      if (hit) { hit.price = (hit.price * hit.touches + p.price) / (hit.touches + 1); hit.touches += 1; hit.lastTime = Math.max(hit.lastTime, p.time); }
      else { zones.push({ price: p.price, touches: 1, lastTime: p.time, distance: Math.abs(pctDistance(current, p.price)), kind }); }
    });
    return zones.map(z => {
      const distance = Math.abs(pctDistance(current, z.price));
      const recencyBonus = candles.findIndex(c => c.t === z.lastTime) >= recentStart ? 14 : 5;
      const broken = side === 'support' ? isBrokenSupport(z.price, z.lastTime) : isBrokenResistance(z.price, z.lastTime);
      const freshnessPenalty = broken ? 28 : 0;
      const touchScore = Math.min(42, z.touches * 13);
      const distanceScore = Math.max(0, 26 - distance * 7);
      const score = Math.round(clamp(touchScore + distanceScore + recencyBonus - freshnessPenalty, 0, 100));
      const band = z.price * (adaptiveTolerance / 100) * (kind === 'MAJOR' ? 1.25 : 0.9);
      return { ...z, distance, top: z.price + band, bottom: z.price - band, score, broken };
    }).filter(z => !z.broken || (z.score || 0) >= 38).sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance)).slice(0, 4);
  };
  return { support: build(swings.lows.filter(x => x.price < current), 'support'), resistance: build(swings.highs.filter(x => x.price > current), 'resistance') };
}

export function getMajorTf(tf: string) { if (tf === '1m') return '5m'; if (tf === '5m') return '15m'; if (tf === '15m') return '1h'; if (tf === '1h') return '4h'; return '4h'; }

export function analyzeTimeframe(candles: Candle[], tf: string) {
  if (!candles || candles.length < 35) return { tf, trend: 'NO DATA' as const, score: 0, momentum: 0, volumeState: 'LOW' as const };
  const last = candles[candles.length - 1]; const prev20 = candles.slice(-21, -1);
  const avgClose = prev20.reduce((s, c) => s + c.c, 0) / prev20.length;
  const avgVol = prev20.reduce((s, c) => s + c.v, 0) / prev20.length;
  const base = candles[candles.length - 12]?.c || last.c;
  const momentum = ((last.c - base) / base) * 100;
  const trend = last.c > avgClose && momentum > 0 ? 'BULLISH' as const : last.c < avgClose && momentum < 0 ? 'BEARISH' as const : 'RANGE' as const;
  const score = trend === 'BULLISH' ? 1 : trend === 'BEARISH' ? -1 : 0;
  const volumeState = last.v > avgVol * 1.35 ? 'EXPANSION' as const : last.v < avgVol * 0.75 ? 'LOW' as const : 'NORMAL' as const;
  return { tf, trend, score, momentum, volumeState };
}

export function zoneOverlap(aLow: number, aHigh: number, bLow?: number, bHigh?: number) {
  if (!Number.isFinite(aLow) || !Number.isFinite(aHigh) || bLow === undefined || bHigh === undefined) return false;
  return Math.max(Math.min(aLow, aHigh), Math.min(bLow, bHigh)) <= Math.min(Math.max(aLow, aHigh), Math.max(bLow, bHigh));
}

export function isPriceNearZone(price: number, low: number, high: number, maxDistancePct = 1.15) {
  const mid = (Math.min(low, high) + Math.max(low, high)) / 2;
  return Math.abs(pctDistance(price, mid)) <= maxDistancePct;
}

export function detectOrderBlocks(candles: Candle[], currentPrice: number) {
  if (!candles.length) return { bullish: [] as OrderBlock[], bearish: [] as OrderBlock[] };
  const bodies = candles.slice(-120).map(c => Math.abs(c.c - c.o));
  const avgBody = (bodies.reduce((s, x) => s + x, 0) / Math.max(1, bodies.length)) || 1;
  const avgVol = candles.slice(-120).reduce((s, c) => s + c.v, 0) / Math.max(1, candles.slice(-120).length);
  const bullish: OrderBlock[] = []; const bearish: OrderBlock[] = [];
  for (let i = 8; i < candles.length - 5; i++) {
    const c = candles[i]; const next = candles[i + 1]; const next2 = candles[i + 2]; const next3 = candles[i + 3];
    const preHigh = Math.max(...candles.slice(Math.max(0, i - 8), i).map(x => x.h));
    const preLow = Math.min(...candles.slice(Math.max(0, i - 8), i).map(x => x.l));
    const impulseUpBody = Math.max(next.c, next2.c, next3.c) - c.c;
    const impulseDownBody = c.c - Math.min(next.c, next2.c, next3.c);
    const volExpansion = Math.max(next.v, next2.v, next3.v) > avgVol * 1.18; // FIXED TYPO
    const breakUp = [next, next2, next3].some(x => x.c > preHigh);
    const breakDown = [next, next2, next3].some(x => x.c < preLow);
    const upImpulse = c.c < c.o && impulseUpBody > avgBody * 1.45 && breakUp;
    const downImpulse = c.c > c.o && impulseDownBody > avgBody * 1.45 && breakDown;
    if (upImpulse) {
      const top = c.h; const bottom = c.l; const future = candles.slice(i + 4);
      const mitigated = future.some(x => x.l <= top && x.h >= bottom);
      const invalidated = future.some(x => x.c < bottom); // FIXED TYPO
      const mid = (top + bottom) / 2;
      const rawStrength = (impulseUpBody / avgBody) * 18 + (volExpansion ? 18 : 0) + (breakUp ? 16 : 0) - (mitigated ? 8 : 0) - (invalidated ? 42 : 0);
      const strength = clamp(rawStrength, 0, 100);
      const quality: OrderBlock['quality'] = strength >= 68 ? 'STRONG' : strength >= 48 ? 'MEDIUM' : 'WEAK';
      bullish.push({ type: 'BULLISH_OB', top, bottom, startIndex: i, sourceTime: c.t, mitigated, invalidated, quality, strength, distance: Math.abs(pctDistance(currentPrice, mid)) });
    }
    if (downImpulse) {
      const top = c.h; const bottom = c.l; const future = candles.slice(i + 4);
      const mitigated = future.some(x => x.h >= bottom && x.l <= top);
      const invalidated = future.some(x => x.c > top);
      const mid = (top + bottom) / 2;
      const rawStrength = (impulseDownBody / avgBody) * 18 + (volExpansion ? 18 : 0) + (breakDown ? 16 : 0) - (mitigated ? 8 : 0) - (invalidated ? 42 : 0);
      const strength = clamp(rawStrength, 0, 100);
      const quality: OrderBlock['quality'] = strength >= 68 ? 'STRONG' : strength >= 48 ? 'MEDIUM' : 'WEAK';
      bearish.push({ type: 'BEARISH_OB', top, bottom, startIndex: i, sourceTime: c.t, mitigated, invalidated, quality, strength, distance: Math.abs(pctDistance(currentPrice, mid)) });
    }
  }
  const sorter = (a: OrderBlock, b: OrderBlock) => {
    const invalidPenalty = (a.invalidated ? 1 : 0) - (b.invalidated ? 1 : 0);
    if (invalidPenalty !== 0) return invalidPenalty;
    const qualityDiff = b.strength - a.strength;
    if (Math.abs(qualityDiff) > 12) return qualityDiff;
    return a.distance - b.distance;
  };
  return {
    bullish: bullish.filter(x => !x.invalidated && x.quality !== 'WEAK').sort(sorter).slice(0, 4),
    bearish: bearish.filter(x => !x.invalidated && x.quality !== 'WEAK').sort(sorter).slice(0, 4)
  };
}

export function analyzeStructure(candles: Candle[]): StructureSummary {
  if (!candles.length) return { bias: 'RANGE', points: [], events: [], summary: 'Data belum cukup.' };
  const lookback = candles.length > 180 ? 4 : 3;
  const swings = detectSwings(candles, lookback);
  const swingItems = [...swings.highs.map(x => ({ ...x, side: 'high' as const })), ...swings.lows.map(x => ({ ...x, side: 'low' as const }))].sort((a, b) => a.index - b.index);
  const points: StructurePoint[] = []; const events: StructureEvent[] = [];
  let prevHigh: any; let prevLow: any; let trend: 'BULLISH' | 'BEARISH' | 'RANGE' = 'RANGE';
  for (const item of swingItems) {
    if (item.side === 'high') {
      if (!prevHigh) { prevHigh = item; continue; }
      const label: 'HH' | 'LH' = item.price > prevHigh.price ? 'HH' : 'LH';
      points.push({ index: item.index, price: item.price, label, side: 'high', time: item.time });
      const closeBreak = candles.slice(prevHigh.index + 1, item.index + 4).some(c => c.c > prevHigh.price);
      if (label === 'HH' && closeBreak) { events.push({ index: item.index, price: item.price, label: trend === 'BEARISH' ? 'CHoCH UP' : 'BOS UP', time: item.time }); trend = 'BULLISH'; }
      prevHigh = item;
    } else {
      if (!prevLow) { prevLow = item; continue; }
      const label: 'HL' | 'LL' = item.price > prevLow.price ? 'HL' : 'LL';
      points.push({ index: item.index, price: item.price, label, side: 'low', time: item.time });
      const closeBreak = candles.slice(prevLow.index + 1, item.index + 4).some(c => c.c < prevLow.price);
      if (label === 'LL' && closeBreak) { events.push({ index: item.index, price: item.price, label: trend === 'BULLISH' ? 'CHoCH DOWN' : 'BOS DOWN', time: item.time }); trend = 'BEARISH'; }
      prevLow = item;
    }
  }
  const recent = points.slice(-6);
  const hh = recent.filter(x => x.label === 'HH').length; const hl = recent.filter(x => x.label === 'HL').length;
  const lh = recent.filter(x => x.label === 'LH').length; const ll = recent.filter(x => x.label === 'LL').length;
  let bias: StructureSummary['bias'] = 'RANGE';
  if (trend === 'BULLISH' && hh + hl >= lh + ll) bias = 'BULLISH';
  else if (trend === 'BEARISH' && lh + ll >= hh + hl) bias = 'BEARISH';
  else if (hh + hl >= 4) bias = 'BULLISH';
  else if (lh + ll >= 4) bias = 'BEARISH';
  const summary = bias === 'BULLISH' ? 'Structure v2 bullish: close break mendukung HH/HL.' : bias === 'BEARISH' ? 'Structure v2 bearish: close break mendukung LH/LL.' : 'Structure v2 mixed/range: tunggu BOS/CHoCH yang lebih bersih.';
  return { bias, points: points.sort((a, b) => a.index - b.index).slice(-12), events: events.sort((a, b) => a.index - b.index).slice(-8), summary };
}

export function candleBody(c: Candle) { return Math.abs(c.c - c.o); }
export function upperWick(c: Candle) { return c.h - Math.max(c.o, c.c); }
export function lowerWick(c: Candle) { return Math.min(c.o, c.c) - c.l; }
export function isInsideZone(price: number, low: number, high: number) { return price >= Math.min(low, high) && price <= Math.max(low, high); }
export function distanceToZonePct(price: number, low: number, high: number) {
  const lo = Math.min(low, high); const hi = Math.max(low, high);
  if (isInsideZone(price, lo, hi)) return 0;
  return Math.abs(pctDistance(price, price < lo ? lo : hi));
}
export function obStatusText(ob?: OrderBlock) {
  if (!ob) return 'No OB'; if (ob.invalidated) return 'Invalid';
  return `${ob.quality} • ${!ob.mitigated ? 'Fresh' : 'Mitigated'} • Strength ${Math.round(ob.strength)}`;
}

export function find15mRefinement(k15: Candle[], current: number, zone: {low: number; high: number}, side: 'LONG' | 'SHORT') {
  const lo = Math.min(zone.low, zone.high); const hi = Math.max(zone.low, zone.high);
  const inZone = k15.filter(c => c.h >= lo && c.l <= hi).slice(-90);
  const base = inZone.length ? inZone : k15.slice(-90);
  const zones = detectSrnZones(base, current, 0.18, '15m', 'ACTIVE');
  const obs = detectOrderBlocks(base, current);
  if (side === 'LONG') {
    const ob = obs.bullish[0]; const support = zones.support[0];
    if (ob) return { low: ob.bottom, high: ob.top, label: `15M refined demand $${fmt(ob.bottom)} - $${fmt(ob.top)}`, score: ob.quality === 'STRONG' ? 10 : 7 };
    if (support) return { low: support.bottom || support.price, high: support.top || support.price, label: `15M support refine $${fmt(support.bottom || support.price)} - $${fmt(support.top || support.price)}`, score: 6 };
  } else {
    const ob = obs.bearish[0]; const resistance = zones.resistance[0];
    if (ob) return { low: ob.bottom, high: ob.top, label: `15M refined supply $${fmt(ob.bottom)} - $${fmt(ob.top)}`, score: ob.quality === 'STRONG' ? 10 : 7 };
    if (resistance) return { low: resistance.bottom || resistance.price, high: resistance.top || resistance.price, label: `15M resistance refine $${fmt(resistance.bottom || resistance.price)} - $${fmt(resistance.top || resistance.price)}`, score: 6 };
  }
  return { low: lo, high: hi, label: `1H zone direct $${fmt(lo)} - $${fmt(hi)}`, score: 2 };
}

export function detect5mCandlestickTrigger(k5: Candle[], zone: {low: number; high: number}, side: 'LONG' | 'SHORT'): TriggerResult {
  if (k5.length < 28) return { side: 'NONE', pattern: 'NO DATA', score: 0, valid: false, late: false, detail: '5M data belum cukup.' };
  const last = k5[k5.length - 1]; const prev = k5[k5.length - 2]; const prev2 = k5[k5.length - 3];
  const recent = k5.slice(-24, -1);
  const avgBody = recent.reduce((s, c) => s + candleBody(c), 0) / Math.max(1, recent.length);
  const avgVol = recent.reduce((s, c) => s + c.v, 0) / Math.max(1, recent.length);
  const body = candleBody(last);
  const inZoneNow = last.h >= Math.min(zone.low, zone.high) && last.l <= Math.max(zone.low, zone.high);
  const dist = distanceToZonePct(last.c, zone.low, zone.high);
  const late = dist > 0.70 && !inZoneNow;
  const volumeBoost = avgVol > 0 && last.v > avgVol * 1.2;
  const strongBody = body > avgBody * 1.45;
  const nowBull = last.c > last.o; const nowBear = last.c < last.o;
  const sweepLong = lowerWick(last) > body * 1.5 && last.l < prev.l && nowBull;
  const sweepShort = upperWick(last) > body * 1.5 && last.h > prev.h && nowBear;
  const displacementUp = nowBull && strongBody && last.c > prev.h;
  const displacementDown = nowBear && strongBody && last.c < prev.l;
  const fvgBullish = last.l > prev2.h && nowBull && strongBody;
  const fvgBearish = last.h < prev2.l && nowBear && strongBody;
  let pattern = 'NO TRIGGER'; let score = 0; let valid = false;
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
  return { side: valid ? side : 'NONE', pattern, score: clamp(score, 0, 40), valid, late, detail: valid ? `${pattern}${volumeBoost ? ' + Vol Boost' : ''}${late ? ' • LATE risk' : ''}` : 'NO TRIGGER — tunggu Sweep / Displacement + FVG di zona.' };
}

// Force update triggered at 2026-06-15 18:22
