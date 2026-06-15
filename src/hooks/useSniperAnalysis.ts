import { useMemo } from 'react';
import { Candle, Ticker, MarkData, DepthLevel, OiHist, LongShort, TakerFlow, Zone, OrderBlock, StructureSummary, FlowEngine, Plan, ExecutionLevels, AlertItem, SniperMode } from '../types';
import { fmt, fmtShort, fmtPct, safeNumber, pctDistance, buildExecutionLevels, clamp } from '../utils/helpers';
import { analyzeTimeframe, detectSrnZones, getMajorTf, detectOrderBlocks, analyzeStructure, find15mRefinement, detect5mCandlestickTrigger, isPriceNearZone, obStatusText } from '../utils/smcEngine';
import { buildFlowEngine, calcConfluence, scoreSrnAgainstOb } from '../utils/flowEngine';

const SNIPER_BIAS_TFS = '4H Bias + 1H OB';
const SNIPER_ENTRY_TF = '1H OB + 15M Refinement';
const SNIPER_TRIGGER_TF = '5M Candlestick';
const INTERVALS = ['5m', '15m', '1h', '4h'];

export function useSniperAnalysis(
  candles: Candle[], mtf: Record<string, Candle[]>, mark: MarkData, depth: { bids: DepthLevel[]; asks: DepthLevel[] },
  oiHist: OiHist[], longShort: LongShort[], topAccount: LongShort[], takerFlow: TakerFlow[],
  tickers: Ticker[], streamPrice: number, apiStatus: string, sniperMode: SniperMode, selectedSymbol: string
) {
  const lastCandlePrice = candles[candles.length - 1]?.c || 0;
  const lastPrice = streamPrice || safeNumber(tickers.find(t => t.symbol === selectedSymbol)?.lastPrice, lastCandlePrice);
  const markPrice = safeNumber(mark.markPrice, lastPrice);
  const fundingRate = safeNumber(mark.lastFundingRate, 0);
  const priceChange24h = safeNumber(tickers.find(t => t.symbol === selectedSymbol)?.priceChangePercent, 0);

  // 1. MTF Analysis
  const mtfAnalysis = useMemo(() => INTERVALS.map(tf => analyzeTimeframe(mtf[tf] || [], tf)), [mtf]);
  const mtfScore = useMemo(() => mtfAnalysis.reduce((s, x) => s + x.score, 0), [mtfAnalysis]);

  // 2. Zones & Order Blocks
  const activeZones = useMemo(() => detectSrnZones(candles, lastPrice || markPrice, 0.1, '15m', 'ACTIVE'), [candles, lastPrice, markPrice]);
  const majorTf = useMemo(() => getMajorTf('15m'), []);
  const majorSource = useMemo(() => (mtf[majorTf]?.length ? mtf[majorTf] : candles), [mtf, majorTf, candles]);
  const majorZones = useMemo(() => detectSrnZones(majorSource, lastPrice || markPrice, 0.18, majorTf, 'MAJOR'), [majorSource, lastPrice, markPrice, majorTf]);
  const zones = useMemo(() => ({
    support: [...majorZones.support, ...activeZones.support].sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance)).slice(0, 4),
    resistance: [...majorZones.resistance, ...activeZones.resistance].sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance)).slice(0, 4)
  }), [majorZones, activeZones]);
  
  const orderBlocks = useMemo(() => detectOrderBlocks(candles, lastPrice || markPrice), [candles, lastPrice, markPrice]);
  const chartStructure = useMemo(() => analyzeStructure(candles), [candles]);

  // 3. Sniper Anchor (1H OB + 15M Refinement + 5M Trigger)
  const entryCandles15 = useMemo(() => (mtf['15m']?.length ? mtf['15m'] : candles), [mtf, candles]);
  const triggerCandles5 = useMemo(() => (mtf['5m']?.length ? mtf['5m'] : candles), [mtf, candles]);
  const anchorCandles1h = useMemo(() => (mtf['1h']?.length ? mtf['1h'] : candles), [mtf, candles]);
  
  const anchorZones1h = useMemo(() => detectSrnZones(anchorCandles1h, lastPrice || markPrice, 0.32, '1h', 'ACTIVE'), [anchorCandles1h, lastPrice, markPrice]);
  const anchorOrderBlocks1h = useMemo(() => detectOrderBlocks(anchorCandles1h, lastPrice || markPrice), [anchorCandles1h, lastPrice, markPrice]);
  const anchorBullOb1h = useMemo(() => anchorOrderBlocks1h.bullish[0], [anchorOrderBlocks1h]);
  const anchorBearOb1h = useMemo(() => anchorOrderBlocks1h.bearish[0], [anchorOrderBlocks1h]);
  const anchorSupport1h = useMemo(() => anchorZones1h.support.sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance))[0], [anchorZones1h]);
  const anchorResistance1h = useMemo(() => anchorZones1h.resistance.sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance))[0], [anchorZones1h]);

  const chartSetupZones = useMemo(() => {
    const price = lastPrice || markPrice;
    const longZone = anchorBullOb1h ? { low: anchorBullOb1h.bottom, high: anchorBullOb1h.top, label: `1H BULL OB ${anchorBullOb1h.quality}`, side: 'LONG' as const, ob: anchorBullOb1h } : anchorSupport1h ? { low: anchorSupport1h.bottom || anchorSupport1h.price, high: anchorSupport1h.top || anchorSupport1h.price, label: '1H DEMAND/SUP', side: 'LONG' as const, ob: undefined } : null;
    const shortZone = anchorBearOb1h ? { low: anchorBearOb1h.bottom, high: anchorBearOb1h.top, label: `1H BEAR OB ${anchorBearOb1h.quality}`, side: 'SHORT' as const, ob: anchorBearOb1h } : anchorResistance1h ? { low: anchorResistance1h.bottom || anchorResistance1h.price, high: anchorResistance1h.top || anchorResistance1h.price, label: '1H SUPPLY/RES', side: 'SHORT' as const, ob: undefined } : null;
    const build = (zone: typeof longZone) => {
      if (!zone || !price) return null;
      const refinement = find15mRefinement(entryCandles15, price, zone, zone.side);
      const trigger = detect5mCandlestickTrigger(triggerCandles5, refinement, zone.side);
      return { ...zone, refinement, trigger, distance: Math.abs(pctDistance(price, (refinement.low + refinement.high)/2)), invalidation: zone.side === 'LONG' ? Math.min(zone.low, zone.high) : Math.max(zone.low, zone.high) };
    };
    return { longSetup: build(longZone), shortSetup: build(shortZone) };
  }, [lastPrice, markPrice, anchorBullOb1h, anchorBearOb1h, anchorSupport1h, anchorResistance1h, entryCandles15, triggerCandles5]);

  // 4. Flow Engine & Mini Map
  const oiChangePct = useMemo(() => {
    if (oiHist.length < 2) return 0;
    const first = safeNumber(oiHist[0].sumOpenInterest);
    const last = safeNumber(oiHist[oiHist.length - 1].sumOpenInterest);
    return first ? ((last - first) / first) * 100 : 0;
  }, [oiHist]);
  const latestLs = longShort[longShort.length - 1];
  const latestTop = topAccount[topAccount.length - 1];
  const latestTaker = takerFlow[takerFlow.length - 1];
  const takerRatio = safeNumber(latestTaker?.buySellRatio, 0);
  const longShortRatio = safeNumber(latestLs?.longShortRatio, 0);
  const topLongShortRatio = safeNumber(latestTop?.longShortRatio, 0);
  
  const depthStats = useMemo(() => {
    const bid = depth.bids.reduce((s, x) => s + x.notional, 0);
    const ask = depth.asks.reduce((s, x) => s + x.notional, 0);
    const total = bid + ask;
    const imbalance = total ? ((bid - ask) / total) * 100 : 0;
    return { bid, ask, imbalance };
  }, [depth]);

  const miniMap = useMemo(() => {
    const current = lastPrice || markPrice;
    const maxNotional = Math.max(...depth.bids.map(x => x.notional), ...depth.asks.map(x => x.notional), 1);
    const bidWalls = [...depth.bids].filter(x => current ? x.price < current && Math.abs(pctDistance(current, x.price)) <= 5 : true).sort((a, b) => b.notional - a.notional).slice(0, 8).map(x => ({ ...x, distance: current ? pctDistance(current, x.price) : 0, strength: (x.notional / maxNotional) * 100 }));
    const askWalls = [...depth.asks].filter(x => current ? x.price > current && Math.abs(pctDistance(current, x.price)) <= 5 : true).sort((a, b) => b.notional - a.notional).slice(0, 8).map(x => ({ ...x, distance: current ? pctDistance(current, x.price) : 0, strength: (x.notional / maxNotional) * 100 }));
    const bidTotal = bidWalls.reduce((s, x) => s + x.notional, 0);
    const askTotal = askWalls.reduce((s, x) => s + x.notional, 0);
    const pressure = askTotal > bidTotal * 1.15 ? 'SELL LIMIT WALL DOMINAN' : bidTotal > askTotal * 1.15 ? 'BUY LIMIT WALL DOMINAN' : 'BALANCED WALLS';
    return { bidWalls, askWalls, bidTotal, askTotal, pressure };
  }, [depth, lastPrice, markPrice]);

  const flow = useMemo(() => buildFlowEngine({ fundingRate, oiChangePct, priceChangePct, longShortRatio, topLongShortRatio, takerRatio, mtfScore, wallImbalance: depthStats.imbalance }), [fundingRate, oiChangePct, priceChange24h, longShortRatio, topLongShortRatio, takerRatio, mtfScore, depthStats.imbalance]);

  // 5. Plan Generation
  const structure5 = useMemo(() => analyzeStructure(triggerCandles5 || []), [triggerCandles5]);
  const structure15 = useMemo(() => analyzeStructure(entryCandles15 || []), [entryCandles15]);
  const structure1h = useMemo(() => analyzeStructure(mtf['1h'] || []), [mtf]);
  const structure4h = useMemo(() => analyzeStructure(mtf['4h'] || []), [mtf]);
  const entryBullOb15 = useMemo(() => detectOrderBlocks(entryCandles15, lastPrice || markPrice).bullish[0], [entryCandles15, lastPrice, markPrice]);
  const entryBearOb15 = useMemo(() => detectOrderBlocks(entryCandles15, lastPrice || markPrice).bearish[0], [entryCandles15, lastPrice, markPrice]);
  const entrySupport15 = useMemo(() => detectSrnZones(entryCandles15, lastPrice || markPrice, 0.14, '15m', 'ACTIVE').support.sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance))[0], [entryCandles15, lastPrice, markPrice]);
  const entryResistance15 = useMemo(() => detectSrnZones(entryCandles15, lastPrice || markPrice, 0.14, '15m', 'ACTIVE').resistance.sort((a, b) => ((b.score || 0) - (a.score || 0)) || (a.distance - b.distance))[0], [entryCandles15, lastPrice, markPrice]);

  const plan: Plan | null = useMemo(() => {
    if (apiStatus !== 'LIVE API' || !lastPrice || !candles.length) return null;
    const longConfluence = calcConfluence({ side: 'LONG', structure4h, structure1h, structure15, ob: entryBullOb15, support: entrySupport15, resistance: entryResistance15, flow, miniPressure: miniMap.pressure });
    const shortConfluence = calcConfluence({ side: 'SHORT', structure4h, structure1h, structure15, ob: entryBearOb15, support: entrySupport15, resistance: entryResistance15, flow, miniPressure: miniMap.pressure });
    const chooseLong = longConfluence.total > shortConfluence.total + 5;
    const chooseShort = shortConfluence.total > longConfluence.total + 5;
    const flowNote = `${flow.state}: ${flow.reasons.slice(0, 5).join(' | ')} | Entry Model ${SNIPER_BIAS_TFS} bias + ${SNIPER_ENTRY_TF} POI + ${SNIPER_TRIGGER_TF} trigger`;
    const warning = 'Accuracy Engine v2.4: SNR v3 + OB v2 + Structure v2 memakai deteksi otomatis berbasis candle Binance Perpetual. Tetap validasi manual sebelum entry.';
    
    const thresholds = sniperMode === 'AGGRESSIVE' ? { valid: 72, ready: 60, risk: 45 } : sniperMode === 'CONSERVATIVE' ? { valid: 88, ready: 74, risk: 60 } : { valid: 80, ready: 66, risk: 50 };
    const statusFromScore = (side: 'LONG' | 'SHORT', score: number, nearZone: boolean, hasOb: boolean): Plan['status'] => {
      const validZoneOk = sniperMode === 'AGGRESSIVE' ? nearZone || hasOb : nearZone && hasOb;
      const conservativeOk = sniperMode !== 'CONSERVATIVE' || hasOb;
      if (score >= thresholds.valid && validZoneOk && conservativeOk) return side === 'LONG' ? 'LONG VALID' : 'SHORT VALID';
      if (score >= thresholds.ready) return side === 'LONG' ? 'LONG READY' : 'SHORT READY';
      if (score >= thresholds.risk) return side === 'LONG' ? 'LONG RISKAN' : 'SHORT RISKAN';
      return 'WAIT';
    };

    if (chooseLong && entryBullOb15) {
      const score = longConfluence.total;
      const nearZone = isPriceNearZone(lastPrice, entryBullOb15.bottom, entryBullOb15.top, 1.2);
      return { status: statusFromScore('LONG', score, nearZone, true), bias: `LONG BIAS | Structure ${structure4h.bias}/${structure1h.bias}/${structure15.bias}`, currentPrice: lastPrice, markPrice, entryZone: [entryBullOb15.bottom, entryBullOb15.top], keyLevels: `Bullish OB ${entryBullOb15.quality}`, trigger: 'Limit buy pada 15M bullish OB. Trigger 5M.', invalidation: `Close 5m di bawah $${fmt(entryBullOb15.bottom * 0.994)}`, tpAreas: [entryResistance15?.price || lastPrice * 1.012], confidence: score, confluenceScore: score, structureScore: longConfluence.structureScore, obScore: longConfluence.obScore, snrScore: longConfluence.snrScore, flowScorePart: longConfluence.flowScorePart, liquidityScore: longConfluence.liquidityScore, flowNote, warning };
    }
    if (chooseShort && entryBearOb15) {
      const score = shortConfluence.total;
      const nearZone = isPriceNearZone(lastPrice, entryBearOb15.bottom, entryBearOb15.top, 1.2);
      return { status: statusFromScore('SHORT', score, nearZone, true), bias: `SHORT BIAS | Structure ${structure4h.bias}/${structure1h.bias}/${structure15.bias}`, currentPrice: lastPrice, markPrice, entryZone: [entryBearOb15.bottom, entryBearOb15.top], keyLevels: `Bearish OB ${entryBearOb15.quality}`, trigger: 'Limit short pada 15M bearish OB. Trigger 5M.', invalidation: `Close 5m di atas $${fmt(entryBearOb15.top * 1.006)}`, tpAreas: [entrySupport15?.price || lastPrice * 0.988], confidence: score, confluenceScore: score, structureScore: shortConfluence.structureScore, obScore: shortConfluence.obScore, snrScore: shortConfluence.snrScore, flowScorePart: shortConfluence.flowScorePart, liquidityScore: shortConfluence.liquidityScore, flowNote, warning };
    }
    const best = Math.max(longConfluence.total, shortConfluence.total);
    return { status: best < 45 ? 'NO TRADE' : 'WAIT', bias: `MIXED | Long ${longConfluence.total} vs Short ${shortConfluence.total}`, currentPrice: lastPrice, markPrice, keyLevels: '-', trigger: 'Confluence belum cukup bersih.', invalidation: 'Tunggu BOS/CHoCH.', tpAreas: [], confidence: best, confluenceScore: best, structureScore: Math.max(longConfluence.structureScore, shortConfluence.structureScore), obScore: Math.max(longConfluence.obScore, shortConfluence.obScore), snrScore: Math.max(longConfluence.snrScore, shortConfluence.snrScore), flowScorePart: Math.max(longConfluence.flowScorePart, shortConfluence.flowScorePart), liquidityScore: Math.max(longConfluence.liquidityScore, shortConfluence.liquidityScore), flowNote, warning };
  }, [apiStatus, lastPrice, markPrice, candles.length, mtfAnalysis, flow, entrySupport15, entryResistance15, mtfScore, entryBullOb15, entryBearOb15, structure5, structure15, structure1h, structure4h, miniMap.pressure, sniperMode]);

  const selectedExecution = useMemo(() => {
    if (!plan?.entryZone) return null;
    const side: 'LONG' | 'SHORT' = (plan.status.includes('SHORT') || plan.bias.includes('SHORT')) ? 'SHORT' : 'LONG';
    const invalidBase = side === 'LONG' ? (chartSetupZones.longSetup?.invalidation ?? plan.entryZone[0]) : (chartSetupZones.shortSetup?.invalidation ?? plan.entryZone[1]);
    return buildExecutionLevels(side, { low: plan.entryZone[0], high: plan.entryZone[1] }, invalidBase, plan.tpAreas);
  }, [plan, chartSetupZones]);

  const copyText = useMemo(() => {
    if (!plan) return 'LIVE API belum aktif.';
    return [
      `PAIR: ${selectedSymbol}`, `STATUS: ${plan.status}`, `BIAS: ${plan.bias}`, `PRICE: $${fmt(plan.currentPrice)}`,
      `ENTRY ZONE: $${fmt(plan.entryZone?.[0] || 0)} - $${fmt(plan.entryZone?.[1] || 0)}`,
      `ENTRY AGGRESSIVE: ${selectedExecution ? `$${fmt(selectedExecution.aggressive)}` : '-'}`,
      `STOP LOSS: ${selectedExecution ? `$${fmt(selectedExecution.stopLoss)}` : '-'}`,
      `TP: ${selectedExecution ? `TP1: $${fmt(selectedExecution.tps[0])} | TP2: $${fmt(selectedExecution.tps[1])} | TP3: $${fmt(selectedExecution.tps[2])}` : '-'}`,
      `CONFLUENCE: ${plan.confluenceScore}/100`, `FLOW: ${flow.bias} (${flow.flowScore}/100)`
    ].join('\n');
  }, [plan, selectedSymbol, selectedExecution, flow]);

  const scannerRows = useMemo(() => {
    return [...tickers].filter(t => t.symbol.endsWith('USDT') && safeNumber(t.quoteVolume) > 0).map(t => {
      const change = safeNumber(t.priceChangePercent);
      const qv = safeNumber(t.quoteVolume);
      const volatility = Math.abs(change);
      const volumeScore = clamp(Math.log10(qv + 1) * 5, 0, 60);
      const volScore = clamp(volatility * 3, 0, 40);
      const heatScore = Math.round(clamp(volumeScore + volScore, 0, 100));
      const setup = change > 4 ? 'LONG MOMENTUM' : change < -4 ? 'SHORT MOMENTUM' : volatility > 2.5 ? 'ACTIVE RANGE' : 'WATCH';
      return { ...t, change, qv, heatScore, setup };
    }).sort((a, b) => b.heatScore - a.heatScore).slice(0, 30);
  }, [tickers]);

  return {
    lastPrice, markPrice, fundingRate, priceChange24h, mtfAnalysis, mtfScore, zones, orderBlocks, chartStructure,
    chartSetupZones, structure4h, structure1h, structure15, structure5, flow, miniMap, depthStats,
    plan, selectedExecution, copyText, scannerRows, oiChangePct, longShortRatio, topLongShortRatio, takerRatio
  };
}
