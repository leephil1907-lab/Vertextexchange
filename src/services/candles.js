/* Builds real OHLCV candles from CoinGecko market_chart data (original code). */
import { getChart } from "./coingecko.js";

export const TIMEFRAMES = [
  { id: "5m", label: "5m", bucketMs: 300e3, days: 1 },
  { id: "15m", label: "15m", bucketMs: 900e3, days: 1 },
  { id: "1H", label: "1H", bucketMs: 3600e3, days: 7 },
  { id: "4H", label: "4H", bucketMs: 14400e3, days: 30 },
  { id: "1D", label: "1D", bucketMs: 86400e3, days: 180 },
  { id: "1W", label: "1W", bucketMs: 604800e3, days: 365 },
];

export function tfMeta(tfId) {
  return TIMEFRAMES.find((t) => t.id === tfId) || TIMEFRAMES[2];
}

function buildCandles(prices, volumes, bucketMs) {
  const buckets = new Map();
  prices.forEach(([t, p], i) => {
    const bt = Math.floor(t / bucketMs) * bucketMs;
    const v = volumes && volumes[i] ? volumes[i][1] : 0;
    const b = buckets.get(bt);
    if (!b) buckets.set(bt, { t: bt, o: p, h: p, l: p, c: p, v });
    else { b.h = Math.max(b.h, p); b.l = Math.min(b.l, p); b.c = p; b.v += v / Math.max(1, bucketMs / 300e3); }
  });
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

/* Fetch real candles for a coin/timeframe. Returns {candles, bucketMs, fromCache, stale, age} */
export async function fetchCandles(coinId, vs, tfId) {
  const tf = tfMeta(tfId);
  const r = await getChart(coinId, vs, tf.days);
  const candles = buildCandles(r.data.prices, r.data.total_volumes, tf.bucketMs);
  return { candles, bucketMs: tf.bucketMs, fromCache: r.fromCache, stale: r.stale, age: r.age };
}

/* Live-update the last candle from a real price poll; rolls a new bucket when needed. */
export function applyLivePrice(candles, bucketMs, price, t = Date.now()) {
  if (!price || !candles.length) return candles;
  const bt = Math.floor(t / bucketMs) * bucketMs;
  const last = candles[candles.length - 1];
  if (last.t === bt) {
    last.c = price;
    last.h = Math.max(last.h, price);
    last.l = Math.min(last.l, price);
  } else if (bt > last.t) {
    candles.push({ t: bt, o: price, h: price, l: price, c: price, v: 0 });
    if (candles.length > 800) candles.shift();
  }
  return candles;
}
