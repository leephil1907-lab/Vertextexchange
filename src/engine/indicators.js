/* Technical indicators (original implementations). Input: candles [{t,o,h,l,c,v}] */

export function emaValues(candles, period) {
  const k = 2 / (period + 1);
  let prev = null;
  return candles.map((c) => {
    prev = prev === null ? c.c : c.c * k + prev * (1 - k);
    return prev;
  });
}

export function emaSeries(candles, period) {
  const vals = emaValues(candles, period);
  return candles.map((c, i) => ({ time: Math.floor(c.t / 1000), value: vals[i] }));
}

export function rsiSeries(candles, period = 14) {
  const out = [];
  let avgGain = null, avgLoss = null;
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const ch = candles[i].c - candles[i - 1].c;
    const gain = Math.max(ch, 0), loss = Math.max(-ch, 0);
    if (i <= period) {
      avgGain = (avgGain || 0) + gain / period;
      avgLoss = (avgLoss || 0) + loss / period;
      if (i === period) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else out.push(null);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return candles
    .map((c, i) => (out[i] == null ? null : { time: Math.floor(c.t / 1000), value: out[i] }))
    .filter(Boolean);
}

export function macdSeries(candles, fast = 12, slow = 26, signal = 9) {
  const f = emaValues(candles, fast);
  const s = emaValues(candles, slow);
  const macdLine = candles.map((_, i) => (i < slow - 1 ? null : f[i] - s[i]));
  const valid = macdLine.filter((v) => v != null);
  const k = 2 / (signal + 1);
  let prev = null;
  const sigByIndex = {};
  valid.forEach((v, i) => {
    prev = prev === null ? v : v * k + prev * (1 - k);
    if (i >= signal - 1) sigByIndex[candles.length - valid.length + i] = prev;
  });
  const out = [];
  candles.forEach((c, i) => {
    if (macdLine[i] == null || sigByIndex[i] == null) return;
    out.push({
      time: Math.floor(c.t / 1000),
      macd: macdLine[i],
      signal: sigByIndex[i],
      hist: macdLine[i] - sigByIndex[i],
    });
  });
  return out;
}
