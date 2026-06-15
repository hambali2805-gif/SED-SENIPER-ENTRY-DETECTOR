import React, { useState } from 'react';
import { BacktestTrade, BacktestMetrics, BacktestConfig, DEFAULT_BACKTEST_CONFIG, runBacktest, exportBacktestToCSV } from '../utils/backtestEngine';
import { fmt, fmtPct } from '../utils/helpers';
import { Activity, Download, Play, Settings } from 'lucide-react';

export default function BacktestPanel() {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    setRunning(true);
    setError('');
    try {
      const result = await runBacktest(config);
      setTrades(result.trades);
      setMetrics(result.metrics);
    } catch (err: any) {
      setError(err.message || 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    if (!metrics) return;
    const csv = exportBacktestToCSV(trades, metrics);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_${config.symbol}_${config.timeframe}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel backtestPanel">
      <div className="sectionTitle">
        <Activity size={15} /> Backtesting Engine
      </div>
      
      <div className="backtestConfig">
        <div className="configRow">
          <label>Symbol</label>
          <input 
            value={config.symbol} 
            onChange={e => setConfig({...config, symbol: e.target.value})}
            placeholder="BTCUSDT"
          />
        </div>
        <div className="configRow">
          <label>Timeframe</label>
          <select value={config.timeframe} onChange={e => setConfig({...config, timeframe: e.target.value as any})}>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
          </select>
        </div>
        <div className="configRow">
          <label>Candles</label>
          <input 
            type="number" 
            value={config.candleLimit} 
            onChange={e => setConfig({...config, candleLimit: Number(e.target.value)})}
            min={100}
            max={5000}
          />
        </div>
        <div className="configRow">
          <label>Mode</label>
          <select value={config.sniperMode} onChange={e => setConfig({...config, sniperMode: e.target.value as any})}>
            <option value="AGGRESSIVE">Aggressive</option>
            <option value="NORMAL">Normal</option>
            <option value="CONSERVATIVE">Conservative</option>
          </select>
        </div>
        <div className="configRow">
          <label>Min Confluence</label>
          <input 
            type="number" 
            value={config.minConfluence} 
            onChange={e => setConfig({...config, minConfluence: Number(e.target.value)})}
            min={50}
            max={90}
          />
        </div>
        <div className="configRow checkbox">
          <label>
            <input 
              type="checkbox" 
              checked={config.requireOB} 
              onChange={e => setConfig({...config, requireOB: e.target.checked})}
            />
            Require OB
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={config.requireTrigger} 
              onChange={e => setConfig({...config, requireTrigger: e.target.checked})}
            />
            Require Trigger
          </label>
        </div>
      </div>

      <div className="backtestActions">
        <button className="runBtn" onClick={handleRun} disabled={running}>
          <Play size={15} /> {running ? 'Running...' : 'Run Backtest'}
        </button>
        {metrics && metrics.totalTrades > 0 && (
          <button className="exportBtn" onClick={handleExport}>
            <Download size={15} /> Export CSV
          </button>
        )}
      </div>

      {error && <div className="errorBox">{error}</div>}

      {metrics && (
        <div className="metricsGrid">
          <div className="metricCard">
            <span>Total Trades</span>
            <b>{metrics.totalTrades}</b>
          </div>
          <div className="metricCard">
            <span>Win Rate</span>
            <b className={metrics.winRate >= 50 ? 'green' : 'red'}>{metrics.winRate.toFixed(1)}%</b>
          </div>
          <div className="metricCard">
            <span>Profit Factor</span>
            <b className={metrics.profitFactor >= 1.5 ? 'green' : metrics.profitFactor >= 1 ? 'yellow' : 'red'}>
              {metrics.profitFactor.toFixed(2)}
            </b>
          </div>
          <div className="metricCard">
            <span>Total PnL</span>
            <b className={metrics.totalPnl >= 0 ? 'green' : 'red'}>{fmtPct(metrics.totalPnl)}</b>
          </div>
          <div className="metricCard">
            <span>Avg Win</span>
            <b className="green">{fmtPct(metrics.avgWin)}</b>
          </div>
          <div className="metricCard">
            <span>Avg Loss</span>
            <b className="red">{fmtPct(metrics.avgLoss)}</b>
          </div>
          <div className="metricCard">
            <span>Max Drawdown</span>
            <b className="red">{fmtPct(metrics.maxDrawdown)}</b>
          </div>
          <div className="metricCard">
            <span>Sharpe Ratio</span>
            <b className={metrics.sharpeRatio >= 1 ? 'green' : metrics.sharpeRatio >= 0 ? 'yellow' : 'red'}>
              {metrics.sharpeRatio.toFixed(2)}
            </b>
          </div>
          <div className="metricCard">
            <span>Expectancy</span>
            <b className={metrics.expectancy >= 0 ? 'green' : 'red'}>{fmtPct(metrics.expectancy)}</b>
          </div>
          <div className="metricCard">
            <span>Avg R:R</span>
            <b>{metrics.avgRRR.toFixed(2)}</b>
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <div className="tradesList">
          <h3>Recent Trades</h3>
          <div className="tradesTable">
            <div className="tradeHeader">
              <span>Time</span>
              <span>Side</span>
              <span>Entry</span>
              <span>Exit</span>
              <span>PnL</span>
              <span>RRR</span>
              <span>Score</span>
            </div>
            {trades.slice(-20).reverse().map((t, idx) => (
              <div key={idx} className={`tradeRow ${t.result.toLowerCase()}`}>
                <span>{new Date(t.timestamp).toLocaleDateString()}</span>
                <span className={t.side === 'LONG' ? 'green' : 'red'}>{t.side}</span>
                <span>${fmt(t.entryPrice)}</span>
                <span>${fmt(t.exitPrice)}</span>
                <span className={t.pnl >= 0 ? 'green' : 'red'}>{fmtPct(t.pnl)}</span>
                <span>{t.rrr.toFixed(2)}</span>
                <span>{t.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
