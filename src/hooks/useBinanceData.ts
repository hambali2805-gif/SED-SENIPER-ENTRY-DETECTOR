import { useEffect, useRef, useState, useCallback } from 'react';
import { Candle, Ticker, SymbolInfo, MarkData, DepthLevel, OiHist, LongShort, TakerFlow } from '../types';
import { API, FUTURES_DATA, parseKlines, apiGet, safeNumber } from '../utils/helpers';

export function useBinanceData() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(() => localStorage.getItem('binanceSelectedSymbol') || 'BTCUSDT');
  const [interval, setIntervalState] = useState(() => localStorage.getItem('binanceInterval') || '15m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [mtf, setMtf] = useState<Record<string, Candle[]>>({ '5m': [], '15m': [], '1h': [], '4h': [] });
  const [mark, setMark] = useState<MarkData>({});
  const [depth, setDepth] = useState<{ bids: DepthLevel[]; asks: DepthLevel[] }>({ bids: [], asks: [] });
  const [oiNow, setOiNow] = useState<number>(0);
  const [oiHist, setOiHist] = useState<OiHist[]>([]);
  const [fundingHistory, setFundingHistory] = useState<any[]>([]);
  const [longShort, setLongShort] = useState<LongShort[]>([]);
  const [topAccount, setTopAccount] = useState<LongShort[]>([]);
  const [takerFlow, setTakerFlow] = useState<TakerFlow[]>([]);
  const [apiStatus, setApiStatus] = useState<'CHECKING' | 'LIVE API' | 'API OFF'>('CHECKING');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveSync, setLiveSync] = useState(() => localStorage.getItem('binanceLiveSync') === 'true');
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'REALTIME ON' | 'WS OFF'>('WS OFF');
  const [streamPrice, setStreamPrice] = useState(0);
  const [streamResetKey, setStreamResetKey] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const lastWsRenderRef = useRef(0);

  const fetchKlines = useCallback(async (symbol: string, tf: string, limit = 220) => {
    const raw = await apiGet<any[]>(`${API}/fapi/v1/klines`, { symbol, interval: tf, limit });
    return parseKlines(raw);
  }, []);

  const loadStatic = useCallback(async () => {
    try {
      setApiStatus('CHECKING');
      const [exchange, tickerAll] = await Promise.all([
        apiGet<any>(`${API}/fapi/v1/exchangeInfo`),
        apiGet<Ticker[]>(`${API}/fapi/v1/ticker/24hr`)
      ]);
      const tradable = (exchange.symbols || [])
        .filter((s: any) => s.contractType === 'PERPETUAL' && s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map((s: any) => ({ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: s.quoteAsset, status: s.status }))
        .sort((a: SymbolInfo, b: SymbolInfo) => a.symbol.localeCompare(b.symbol));
      setSymbols(tradable);
      setTickers(tickerAll.filter(t => t.symbol.endsWith('USDT')));
      setApiStatus('LIVE API');
    } catch (err: any) {
      setApiStatus('API OFF');
      setApiError(`Gagal load Binance Futures: ${err?.message || err}`);
    }
  }, []);

  const loadSymbol = useCallback(async (symbol = selectedSymbol) => {
    setLoading(true);
    setApiError('');
    try {
      const [activeCandles, mtf5, mtf15, mtf1h, mtf4h, markData, depthData, oi, oiHistory, funding, ls, topAcc, taker, tickerAll] = await Promise.all([
        fetchKlines(symbol, interval, 240),
        fetchKlines(symbol, '5m', 220),
        fetchKlines(symbol, '15m', 220),
        fetchKlines(symbol, '1h', 220),
        fetchKlines(symbol, '4h', 220),
        apiGet<MarkData>(`${API}/fapi/v1/premiumIndex`, { symbol }),
        apiGet<any>(`${API}/fapi/v1/depth`, { symbol, limit: 100 }),
        apiGet<any>(`${API}/fapi/v1/openInterest`, { symbol }),
        apiGet<OiHist[]>(`${FUTURES_DATA}/openInterestHist`, { symbol, period: '5m', limit: 30 }),
        apiGet<any[]>(`${API}/fapi/v1/fundingRate`, { symbol, limit: 8 }),
        apiGet<LongShort[]>(`${FUTURES_DATA}/globalLongShortAccountRatio`, { symbol, period: '5m', limit: 30 }),
        apiGet<LongShort[]>(`${FUTURES_DATA}/topLongShortAccountRatio`, { symbol, period: '5m', limit: 30 }),
        apiGet<TakerFlow[]>(`${FUTURES_DATA}/takerlongshortRatio`, { symbol, period: '5m', limit: 30 }),
        apiGet<Ticker[]>(`${API}/fapi/v1/ticker/24hr`)
      ]);
      setCandles(activeCandles);
      setMtf({ '5m': mtf5, '15m': mtf15, '1h': mtf1h, '4h': mtf4h });
      setMark(markData || {});
      setDepth({
        bids: (depthData?.bids || []).slice(0, 100).map((b: any[]) => ({ price: Number(b[0]), qty: Number(b[1]), notional: Number(b[0]) * Number(b[1]) })),
        asks: (depthData?.asks || []).slice(0, 100).map((a: any[]) => ({ price: Number(a[0]), qty: Number(a[1]), notional: Number(a[0]) * Number(a[1]) }))
      });
      setOiNow(safeNumber(oi?.openInterest, 0));
      setOiHist(Array.isArray(oiHistory) ? oiHistory : []);
      setFundingHistory(Array.isArray(funding) ? funding : []);
      setLongShort(Array.isArray(ls) ? ls : []);
      setTopAccount(Array.isArray(topAcc) ? topAcc : []);
      setTakerFlow(Array.isArray(taker) ? taker : []);
      setTickers(tickerAll.filter(t => t.symbol.endsWith('USDT')));
      setApiStatus('LIVE API');
      setLastUpdated(Date.now());
    } catch (err: any) {
      setApiStatus('API OFF');
      setCandles([]);
      setMtf({ '5m': [], '15m': [], '1h': [], '4h': [] });
      setApiError(`LIVE API Binance gagal. Tool dikunci tanpa demo. Detail: ${err?.message || err}`);
      setLiveSync(false);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, interval, fetchKlines]);

  // Load static data on mount
  useEffect(() => { loadStatic(); }, [loadStatic]);

  // Load symbol data when symbol/interval changes
  useEffect(() => {
    localStorage.setItem('binanceSelectedSymbol', selectedSymbol);
    localStorage.setItem('binanceInterval', interval);
    loadSymbol(selectedSymbol);
  }, [selectedSymbol, interval, loadSymbol]);

  // Live sync polling
  useEffect(() => {
    if (!liveSync) return;
    const id = window.setInterval(() => loadSymbol(selectedSymbol), 30000);
    return () => window.clearInterval(id);
  }, [liveSync, selectedSymbol, loadSymbol]);

  // WebSocket connection
  useEffect(() => {
    if (apiStatus !== 'LIVE API' || !selectedSymbol || !interval) return;
    const symbol = selectedSymbol.toLowerCase();
    const url = `wss://fstream.binance.com/ws/${symbol}@kline_${interval}`;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setWsStatus('CONNECTING');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus('REALTIME ON');
    ws.onerror = () => setWsStatus('WS OFF');
    ws.onclose = () => setWsStatus('WS OFF');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const k = msg?.k;
        if (!k) return;
        const nextCandle: Candle = {
          t: Number(k.t), o: Number(k.o), h: Number(k.h), l: Number(k.l), c: Number(k.c),
          v: Number(k.v), qv: Number(k.q), trades: Number(k.n),
          takerBuyBase: Number(k.V), takerBuyQuote: Number(k.Q)
        };
        const now = Date.now();
        const closed = !!k.x;
        setStreamPrice(nextCandle.c);
        if (!closed && now - lastWsRenderRef.current < 650) return;
        lastWsRenderRef.current = now;
        setCandles(prev => {
          if (!prev.length) return [nextCandle];
          const last = prev[prev.length - 1];
          if (last.t === nextCandle.t) return [...prev.slice(0, -1), nextCandle];
          if (nextCandle.t > last.t) return [...prev.slice(-239), nextCandle];
          return prev;
        });
      } catch { /* keep stream alive */ }
    };
    return () => { ws.close(); };
  }, [apiStatus, selectedSymbol, interval, streamResetKey]);

  const resetStream = () => {
    setWsStatus('CONNECTING');
    setStreamResetKey(k => k + 1);
    loadSymbol(selectedSymbol);
  };

  return {
    symbols, tickers, selectedSymbol, setSelectedSymbol, interval, setIntervalState,
    candles, mtf, mark, depth, oiNow, oiHist, fundingHistory, longShort, topAccount, takerFlow,
    apiStatus, apiError, loading, liveSync, setLiveSync, lastUpdated,
    wsStatus, streamPrice, fetchKlines, loadSymbol, resetStream
  };
}
