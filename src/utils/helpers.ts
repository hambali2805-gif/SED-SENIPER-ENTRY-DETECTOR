import { Candle, ExecutionLevels } from '../types';

export const API = 'https://fapi.binance.com';
export const FUTURES_DATA = 'https://fapi.binance.com/futures/data';
export const INTERVALS = ['5m', '15m', '1h', '4h'];
export const DEFAULT_WATCH = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ENAUSDT', 'LINKUSDT', 'AVAXUSDT', 'WIFUSDT', 'PEPEUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT', '1000SHIBUSDT', 'APTUSDT', 'AAVEUSDT'];
export const SNIPER_BIAS_TFS = '4H Bias + 1H OB';
export const SNIPER_ENTRY_TF = '1H OB + 15M Refinement';
export const SNIPER_TRIGGER_TF = '5M Candlestick';

export function normalizeZone(low: number, high: number) { return { low: Math.min(low, high), high: Math.max(low, high) }; }

export function buildExecutionLevels(side: 'LONG' | 'SHORT', zone: { low: number; high: number }, invalidationBase?: number, tpHints?: number[]): ExecutionLevels {
  const { low, high } = normalizeZone(zone.low, zone.high);
  const width = Math.max(Math.abs(high - low), Math.abs((high + low) / 2) * 0.0009 || 0.0001);
  const aggressive = side === 'LONG' ? high : low;
  const main = (low + high) / 2;
  const conservative = side === 'LONG' ? low : high;
  const rawStop = typeof invalidationBase === 'number' && Number.isFinite(invalidationBase) ? invalidationBase : side === 'LONG' ? low - width * 0.35 : high + width * 0.35;
  const stopLoss = side === 'LONG' ? Math.min(rawStop, low - width * 0.08) : Math.max(rawStop, high + width * 0.08);
  const risk = Math.max(Math.abs(main - stopLoss), width * 0.7, Math.abs(main) * 0.0012);
  const hinted = (tpHints || []).filter((x): x is number => Number.isFinite(x));
  const generated = side === 'LONG' ? [main + risk * 1.2, main + risk * 2, main + risk * 3] : [main - risk * 1.2, main - risk * 2, main - risk * 3];
  const tps = [hinted[0] ?? generated[0], hinted[1] ?? generated[1], hinted[2] ?? generated[2]] as [number, number, number];
  return { low, high, aggressive, main, conservative, stopLoss, tps };
}

export function fmt(value: number | string | undefined | null, digits = 4) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n || NaN)) return '-';
  const d = Math.abs(n as number) >= 100 ? 2 : digits;
  return (n as number).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtShort(value: number | string | undefined | null) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n || NaN)) return '-';
  const abs = Math.abs(n as number);
  if (abs >= 1_000_000_000) return `${((n as number) / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${((n as number) / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${((n as number) / 1_000).toFixed(2)}K`;
  return fmt(n, 2);
}

export function fmtPct(value: number | string | undefined | null, digits = 2) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n || NaN)) return '-';
  return `${(n as number) >= 0 ? '+' : ''}${(n as number).toFixed(digits)}%`;
}

export function pctDistance(from: number, to: number) { if (!from || !to) return 0; return ((to - from) / from) * 100; }
export function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
export function safeNumber(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

export async function apiGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') qs.append(key, String(value)); });
  const url = `${path}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

export function parseKlines(raw: any[]): Candle[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => ({
    t: Number(k[0]), o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]),
    v: Number(k[5]), qv: Number(k[7]), trades: Number(k[8]), takerBuyBase: Number(k[9]), takerBuyQuote: Number(k[10])
  })).filter(c => Number.isFinite(c.c));
}
