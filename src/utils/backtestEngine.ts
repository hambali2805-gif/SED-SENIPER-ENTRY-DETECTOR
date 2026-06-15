
// ... (kode sebelumnya tetap sama, tapi update bagian ini)

function simulateTrade(
  candles: Candle[],
  entryIndex: number,
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  stopLoss: number,
  tp1: number,
  tp2: number,
  tp3: number,
  slippage: number,
  fee: number
): BacktestTrade {
  const future = candles.slice(entryIndex + 1, entryIndex + 200);
  let exitPrice = entryPrice;
  let result: BacktestTrade['result'] = 'OPEN';
  let holdCandles = 0;
  let exitTpLevel = 0;
  
  for (let i = 0; i < future.length; i++) {
    const c = future[i];
    holdCandles++;
    
    if (side === 'LONG') {
      // Cek SL dulu (prioritas)
      if (c.l <= stopLoss) {
        exitPrice = stopLoss * (1 - slippage / 100);
        result = 'LOSS';
        break;
      }
      // Cek TP bertahap
      if (exitTpLevel === 0 && c.h >= tp1) {
        exitPrice = tp1;
        result = 'WIN';
        exitTpLevel = 1;
        break;
      }
      if (exitTpLevel === 0 && c.h >= tp2) {
        exitPrice = tp2;
        result = 'WIN';
        exitTpLevel = 2;
        break;
      }
      if (exitTpLevel === 0 && c.h >= tp3) {
        exitPrice = tp3;
        result = 'WIN';
        exitTpLevel = 3;
        break;
      }
    } else {
      // SHORT
      if (c.h >= stopLoss) {
        exitPrice = stopLoss * (1 + slippage / 100);
        result = 'LOSS';
        break;
      }
      if (exitTpLevel === 0 && c.l <= tp1) {
        exitPrice = tp1;
        result = 'WIN';
        exitTpLevel = 1;
        break;
      }
      if (exitTpLevel === 0 && c.l <= tp2) {
        exitPrice = tp2;
        result = 'WIN';
        exitTpLevel = 2;
        break;
      }
      if (exitTpLevel === 0 && c.l <= tp3) {
        exitPrice = tp3;
        result = 'WIN';
        exitTpLevel = 3;
        break;
      }
    }
  }
  
  if (result === 'OPEN') {
    const lastCandle = future[future.length - 1];
    exitPrice = lastCandle ? lastCandle.c : entryPrice;
    result = 'BREAKEVEN';
  }
  
  // Kalkulasi PnL yang benar
  const pnlRaw = side === 'LONG' 
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;
  
  // Risk & Reward yang benar
  const risk = Math.abs(entryPrice - stopLoss) / entryPrice;
  const reward = Math.abs(exitPrice - entryPrice) / entryPrice;
  const rrr = risk > 0 ? reward / risk : 0;
  
  // Fee (masuk + keluar)
  const feeCost = fee * 2;
  const pnlAfterFee = pnlRaw - feeCost;
  
  return {
    index: entryIndex,
    timestamp: candles[entryIndex].t,
    side,
    entryPrice,
    stopLoss,
    tp1,
    tp2,
    tp3,
    exitPrice,
    result,
    pnl: pnlAfterFee,
    pnlPct: pnlAfterFee,
    rrr,
    holdCandles,
    score: 0,
    pattern: '',
    exitTpLevel
  };
}

function calculateMetrics(trades: BacktestTrade[]): BacktestMetrics {
  const minSampleWarning = trades.length < 30;
  
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgRRR: 0,
      totalPnl: 0,
      totalPnlPct: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      expectancy: 0,
      avgHoldCandles: 0,
      minSampleWarning
    };
  }
  
  const wins = trades.filter(t => t.result === 'WIN');
  const losses = trades.filter(t => t.result === 'LOSS');
  const breakeven = trades.filter(t => t.result === 'BREAKEVEN');
  
  const winRate = (wins.length / trades.length) * 100;
  
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLossAbs = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? 999 : 0;
  
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 
    ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length 
    : 0;
  
  const avgRRR = trades.reduce((sum, t) => sum + t.rrr, 0) / trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalPnlPct = totalPnl;
  
  // Max Drawdown calculation yang benar
  let maxDrawdown = 0;
  let peak = 0;
  let equity = 0;
  for (const trade of trades) {
    equity += trade.pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  // Sharpe Ratio
  const returns = trades.map(t => t.pnl);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  
  // Expectancy
  const expectancy = (winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss;
  const avgHoldCandles = trades.reduce((sum, t) => sum + t.holdCandles, 0) / trades.length;
  
  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    avgRRR,
    totalPnl,
    totalPnlPct,
    maxDrawdown,
    sharpeRatio,
    expectancy,
    avgHoldCandles,
    minSampleWarning
  };
}

export async function runBacktest(config: BacktestConfig): Promise<{
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  candles: Candle[];
}> {
  console.log(`Starting backtest: ${config.symbol} ${config.timeframe} x${config.candleLimit}`);
  
  const candles = await fetchHistoricalData(config.symbol, config.timeframe, config.candleLimit);
  
  if (candles.length < 100) {
    throw new Error(`Insufficient data: only ${candles.length} candles fetched`);
  }
  
  const trades: BacktestTrade[] = [];
  const minLookback = 50;
  
  for (let i = minLookback; i < candles.length - 20; i++) {
    const historicalCandles = candles.slice(0, i);
    const currentPrice = candles[i].c;
    
    const ob = detectOrderBlocks(historicalCandles, currentPrice);
    const structure = analyzeStructure(historicalCandles);
    const zones = detectSrnZones(historicalCandles, currentPrice, 0.14, config.timeframe);
    
    const bullOb = ob.bullish[0];
    const bearOb = ob.bearish[0];
    const support = zones.support[0];
    const resistance = zones.resistance[0];
    
    const thresholds = config.sniperMode === 'AGGRESSIVE' 
      ? { valid: 60, ready: 50 }
      : config.sniperMode === 'CONSERVATIVE'
      ? { valid: 80, ready: 70 }
      : { valid: 70, ready: 60 };
    
    // LONG Setup
    if (bullOb && !bullOb.invalidated && bullOb.quality !== 'WEAK') {
      const distToOB = Math.abs(pctDistance(currentPrice, (bullOb.top + bullOb.bottom) / 2));
      
      if (distToOB < 1.5) {
        const k5 = candles.slice(Math.max(0, i - 28), i);
        const zone = { low: bullOb.bottom, high: bullOb.top };
        const trigger = detect5mCandlestickTrigger(k5, zone, 'LONG');
        
        const mtfScore = structure.bias === 'BULLISH' ? 2 : 0;
        const flow: FlowEngine = {
          bias: structure.bias === 'BULLISH' ? 'BULLISH' : 'NEUTRAL',
          state: 'Backtest',
          bullishScore: structure.bias === 'BULLISH' ? 60 : 30,
          bearishScore: structure.bias === 'BEARISH' ? 60 : 30,
          flowScore: 50,
          netScore: 0,
          reasons: []
        };
        
        const confluence = calcConfluence({
          side: 'LONG',
          structure4h: structure,
          structure1h: structure,
          structure15: structure,
          ob: bullOb,
          support,
          resistance,
          flow,
          miniPressure: 'BALANCED'
        });
        
        const shouldEnter = config.requireTrigger 
          ? trigger.valid && confluence.total >= thresholds.valid
          : confluence.total >= thresholds.ready;
        
        if (shouldEnter && (!config.requireOB || bullOb)) {
          const entryPrice = currentPrice * (1 + config.slippage / 100);
          const exec = buildExecutionLevels('LONG', zone, bullOb.bottom);
          
          const trade = simulateTrade(
            candles,
            i,
            'LONG',
            entryPrice,
            exec.stopLoss,
            exec.tps[0],
            exec.tps[1],
            exec.tps[2],
            config.slippage,
            config.fee
          );
          
          trade.score = confluence.total;
          trade.pattern = trigger.pattern;
          trades.push(trade);
        }
      }
    }
    
    // SHORT Setup
    if (bearOb && !bearOb.invalidated && bearOb.quality !== 'WEAK') {
      const distToOB = Math.abs(pctDistance(currentPrice, (bearOb.top + bearOb.bottom) / 2));
      
      if (distToOB < 1.5) {
        const k5 = candles.slice(Math.max(0, i - 28), i);
        const zone = { low: bearOb.bottom, high: bearOb.top };
        const trigger = detect5mCandlestickTrigger(k5, zone, 'SHORT');
        
        const mtfScore = structure.bias === 'BEARISH' ? 2 : 0;
        const flow: FlowEngine = {
          bias: structure.bias === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
          state: 'Backtest',
          bullishScore: structure.bias === 'BULLISH' ? 60 : 30,
          bearishScore: structure.bias === 'BEARISH' ? 60 : 30,
          flowScore: 50,
          netScore: 0,
          reasons: []
        };
        
        const confluence = calcConfluence({
          side: 'SHORT',
          structure4h: structure,
          structure1h: structure,
          structure15: structure,
          ob: bearOb,
          support,
          resistance,
          flow,
          miniPressure: 'BALANCED'
        });
        
        const shouldEnter = config.requireTrigger
          ? trigger.valid && confluence.total >= thresholds.valid
          : confluence.total >= thresholds.ready;
        
        if (shouldEnter && (!config.requireOB || bearOb)) {
          const entryPrice = currentPrice * (1 - config.slippage / 100);
          const exec = buildExecutionLevels('SHORT', zone, bearOb.top);
          
          const trade = simulateTrade(
            candles,
            i,
            'SHORT',
            entryPrice,
            exec.stopLoss,
            exec.tps[0],
            exec.tps[1],
            exec.tps[2],
            config.slippage,
            config.fee
          );
          
          trade.score = confluence.total;
          trade.pattern = trigger.pattern;
          trades.push(trade);
        }
      }
    }
  }
  
  const metrics = calculateMetrics(trades);
  
  console.log(`Backtest complete: ${trades.length} trades, ${metrics.winRate.toFixed(1)}% win rate`);
  
  return { trades, metrics, candles };
}

export function exportBacktestToCSV(trades: BacktestTrade[], metrics: BacktestMetrics): string {
  const header = 'Index,Timestamp,Side,Entry,SL,TP1,TP2,TP3,Exit,Result,PnL%,RRR,Hold,Score,Pattern\n';
  const rows = trades.map(t => 
    `${t.index},${t.timestamp},${t.side},${t.entryPrice.toFixed(4)},${t.stopLoss.toFixed(4)},${t.tp1.toFixed(4)},${t.tp2.toFixed(4)},${t.tp3.toFixed(4)},${t.exitPrice.toFixed(4)},${t.result},${t.pnl.toFixed(2)},${t.rrr.toFixed(2)},${t.holdCandles},${t.score},${t.pattern}`
  ).join('\n');
  
  const summary = `\n\nSUMMARY\nTotal Trades,${metrics.totalTrades}\nWins,${metrics.wins}\nLosses,${metrics.losses}\nWin Rate,${metrics.winRate.toFixed(2)}%\nProfit Factor,${metrics.profitFactor.toFixed(2)}\nAvg Win,${metrics.avgWin.toFixed(2)}%\nAvg Loss,${metrics.avgLoss.toFixed(2)}%\nTotal PnL,${metrics.totalPnl.toFixed(2)}%\nMax Drawdown,${metrics.maxDrawdown.toFixed(2)}%\nSharpe Ratio,${metrics.sharpeRatio.toFixed(2)}\nExpectancy,${metrics.expectancy.toFixed(2)}%\nMin Sample Warning,${metrics.minSampleWarning}\n`;
  
  return header + rows + summary;
}
