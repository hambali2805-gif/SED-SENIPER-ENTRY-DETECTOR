import { FlowEngine, StructureSummary, Zone, OrderBlock } from '../types';
import { clamp } from './helpers';

export function scoreSrnAgainstOb(support: Zone | undefined, resistance: Zone | undefined, bullOb: OrderBlock | undefined, bearOb: OrderBlock | undefined, side: 'LONG' | 'SHORT') {
  const zoneOverlap = (aLow: number, aHigh: number, bLow?: number, bHigh?: number) => {
    if (!Number.isFinite(aLow) || !Number.isFinite(aHigh) || bLow === undefined || bHigh === undefined) return false;
    return Math.max(Math.min(aLow, aHigh), Math.min(bLow, bHigh)) <= Math.min(Math.max(aLow, aHigh), Math.max(bLow, bHigh));
  };
  if (side === 'LONG' && support) {
    const overlap = bullOb ? zoneOverlap(bullOb.bottom, bullOb.top, support.bottom, support.top) : false;
    return clamp((support.score || 0) * 0.16 + (overlap ? 8 : 0), 0, 20);
  }
  if (side === 'SHORT' && resistance) {
    const overlap = bearOb ? zoneOverlap(bearOb.bottom, bearOb.top, resistance.bottom, resistance.top) : false;
    return clamp((resistance.score || 0) * 0.16 + (overlap ? 8 : 0), 0, 20);
  }
  return 0;
}

export function calcConfluence(args: { side: 'LONG' | 'SHORT'; structure4h: StructureSummary; structure1h: StructureSummary; structure15: StructureSummary; ob?: OrderBlock; support?: Zone; resistance?: Zone; flow: FlowEngine; miniPressure: string; }) {
  const { side, structure4h, structure1h, structure15, ob, support, resistance, flow, miniPressure } = args;
  const wanted = side === 'LONG' ? 'BULLISH' : 'BEARISH'; const opposite = side === 'LONG' ? 'BEARISH' : 'BULLISH';
  let structureScore = 0;
  if (structure4h.bias !== opposite) structureScore += 6;
  if (structure1h.bias === wanted) structureScore += 9; else if (structure1h.bias !== opposite) structureScore += 4;
  if (structure15.bias === wanted) structureScore += 10; else if (structure15.bias !== opposite) structureScore += 4;
  const obScore = ob ? clamp((ob.quality === 'STRONG' ? 18 : 12) + (ob.mitigated ? -4 : 5) + Math.max(0, 5 - ob.distance * 2), 0, 25) : 0;
  const snrScore = side === 'LONG' ? scoreSrnAgainstOb(support, resistance, ob, undefined, side) : scoreSrnAgainstOb(support, resistance, undefined, ob, side);
  const flowAligned = (side === 'LONG' && flow.bias === 'BULLISH') || (side === 'SHORT' && flow.bias === 'BEARISH');
  const flowScorePart = flowAligned ? clamp(flow.flowScore * 0.2, 0, 20) : flow.bias === 'NEUTRAL' ? 7 : 2;
  const liquidityScore = side === 'LONG' ? (miniPressure.includes('BUY') ? 10 : miniPressure.includes('SELL') ? 3 : 6) : (miniPressure.includes('SELL') ? 10 : miniPressure.includes('BUY') ? 3 : 6);
  const total = Math.round(clamp(structureScore + obScore + snrScore + flowScorePart + liquidityScore, 0, 100));
  return { total, structureScore: Math.round(structureScore), obScore: Math.round(obScore), snrScore: Math.round(snrScore), flowScorePart: Math.round(flowScorePart), liquidityScore: Math.round(liquidityScore) };
}

export function buildFlowEngine(args: { fundingRate: number; oiChangePct: number; priceChangePct: number; longShortRatio: number; topLongShortRatio: number; takerRatio: number; mtfScore: number; wallImbalance: number; }): FlowEngine {
  const { fundingRate, oiChangePct, priceChangePct, longShortRatio, topLongShortRatio, takerRatio, mtfScore, wallImbalance } = args;
  let bull = 0; let bear = 0; const reasons: string[] = [];
  if (takerRatio > 1.12) { bull += 18; reasons.push('taker buy agresif'); } else if (takerRatio > 1.04) { bull += 9; reasons.push('taker buy sedikit dominan'); } else if (takerRatio > 0 && takerRatio < 0.88) { bear += 18; reasons.push('taker sell agresif'); } else if (takerRatio > 0 && takerRatio < 0.96) { bear += 9; reasons.push('taker sell sedikit dominan'); } else reasons.push('taker flow netral');
  if (oiChangePct > 1 && priceChangePct > 0) { bull += 16; reasons.push('OI naik + harga naik = long build-up'); } else if (oiChangePct > 1 && priceChangePct < 0) { bear += 16; reasons.push('OI naik + harga turun = short build-up'); } else if (oiChangePct < -1 && priceChangePct > 0) { bull += 9; reasons.push('OI turun + harga naik = short covering'); } else if (oiChangePct < -1 && priceChangePct < 0) { bear += 9; reasons.push('OI turun + harga turun = long unwind'); } else reasons.push('OI belum ekspansif');
  if (fundingRate > 0.0002) { bear += 8; reasons.push('funding positif = long crowded'); } else if (fundingRate < -0.0002) { bull += 8; reasons.push('funding negatif = short crowded'); } else reasons.push('funding normal');
  if (longShortRatio > 1.55) { bear += 7; reasons.push('account ratio terlalu long'); } else if (longShortRatio > 0 && longShortRatio < 0.72) { bull += 7; reasons.push('account ratio terlalu short'); } else reasons.push('global L/S seimbang');
  if (topLongShortRatio > 1.22) { bull += 9; reasons.push('top trader condong long'); } else if (topLongShortRatio > 0 && topLongShortRatio < 0.82) { bear += 9; reasons.push('top trader condong short'); }
  if (mtfScore >= 2) { bull += 15; reasons.push('MTF bullish sinkron'); } else if (mtfScore <= -2) { bear += 15; reasons.push('MTF bearish sinkron'); } else reasons.push('MTF mixed/range');
  if (wallImbalance > 18) { bull += 8; reasons.push('buy limit wall dominan'); } else if (wallImbalance < -18) { bear += 8; reasons.push('sell limit wall dominan'); } else reasons.push('order wall relatif seimbang');
  const bullishScore = Math.round(clamp(bull, 0, 100)); const bearishScore = Math.round(clamp(bear, 0, 100));
  const netScore = bullishScore - bearishScore; const flowScore = Math.round(clamp(Math.max(bullishScore, bearishScore), 0, 100));
  const bias = netScore >= 14 ? 'BULLISH' as const : netScore <= -14 ? 'BEARISH' as const : 'NEUTRAL' as const;
  let state = 'Neutral / no edge';
  if (bias === 'BULLISH') state = flowScore >= 55 ? 'Bullish continuation / long pressure' : 'Bullish lean';
  if (bias === 'BEARISH') state = flowScore >= 55 ? 'Bearish continuation / short pressure' : 'Bearish lean';
  if (fundingRate > 0.0002 && longShortRatio > 1.45 && bias !== 'BULLISH') state = 'Long crowded / long trap risk';
  if (fundingRate < -0.0002 && longShortRatio > 0 && longShortRatio < 0.75 && bias !== 'BEARISH') state = 'Short crowded / short squeeze risk';
  return { bias, state, bullishScore, bearishScore, flowScore, netScore, reasons };
}
