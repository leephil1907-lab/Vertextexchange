/* ============================================================
   CoinGecko live data client (original code).
   Free public API — throttled request queue + TTL cache +
   last-good localStorage fallback for rate-limit resilience.
   ============================================================ */

const BASE = "https://api.coingecko.com/api/v3";
const MIN_SPACING_MS = 1300;      // keep well under free-tier limits
const CACHE_PREFIX = "vt_cg_cache_v1:";

let lastCall = 0;
const pending = [];
let running = false;

function queue(fn) {
  return new Promise((resolve, reject) => {
    pending.push({ fn, resolve, reject });
    if (!running) run();
  });
}
async function run() {
  running = true;
  while (pending.length) {
    const { fn, resolve, reject } = pending.shift();
    const wait = Math.max(0, MIN_SPACING_MS - (Date.now() - lastCall));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    try { resolve(await fn()); } catch (e) { reject(e); }
  }
  running = false;
}

async function getJSON(url, { retries = 2, timeout = 15000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        const backoff = Math.min(30000, 4000 * (attempt + 1));
        lastErr = new Error("rate-limited");
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("network error");
}

/* ---------- cache helpers ---------- */
function cacheGet(key, ttlMs) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > ttlMs) return { stale: true, data, age: Date.now() - t };
    return { stale: false, data, age: Date.now() - t };
  } catch (e) { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* quota */ }
}

async function cached(url, key, ttlMs, freshTtlMs) {
  const c = cacheGet(key, freshTtlMs);
  if (c && !c.stale) return { data: c.data, fromCache: true, age: c.age };
  try {
    const data = await queue(() => getJSON(url));
    cacheSet(key, data);
    return { data, fromCache: false, age: 0 };
  } catch (e) {
    if (c) return { data: c.data, fromCache: true, stale: true, age: c.age, error: e };
    throw e;
  }
}

/* ---------- public API ---------- */
export const CURRENCIES = {
  EUR: { vs: "eur", symbol: "€", locale: "de-DE" },
  USD: { vs: "usd", symbol: "$", locale: "en-US" },
  GBP: { vs: "gbp", symbol: "£", locale: "en-GB" },
  NGN: { vs: "ngn", symbol: "₦", locale: "en-NG" },
};

export async function getGlobal() {
  const r = await cached(`${BASE}/global`, "global", 24 * 3600e3, 60e3);
  return r;
}

export async function getMarkets(vs = "eur", page = 1, perPage = 100) {
  const url = `${BASE}/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=1h%2C24h%2C7d`;
  return cached(url, `markets_${vs}_${page}_${perPage}`, 10 * 60e3, 45e3);
}

export async function getCoin(id, vs = "eur") {
  const url = `${BASE}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  return cached(url, `coin_${id}`, 10 * 60e3, 45e3);
}

export async function getChart(id, vs = "eur", days = 1) {
  const url = `${BASE}/coins/${id}/market_chart?vs_currency=${vs}&days=${days}`;
  return cached(url, `chart_${id}_${vs}_${days}`, 30 * 60e3, 25e3);
}

export async function getSimplePrices(ids = [], vsList = ["eur"]) {
  if (!ids.length) return { data: {}, fromCache: false, age: 0 };
  const key = `simple_${ids.join(",")}_${vsList.join(",")}`;
  const url = `${BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=${vsList.join(",")}&include_24hr_change=true&include_24hr_vol=true`;
  // live prices: short fresh TTL, always try network first
  return cached(url, key, 60e3, 12e3);
}

export function fmtMoney(value, currency = "EUR", compact = false) {
  const c = CURRENCIES[currency] || CURRENCIES.EUR;
  if (value == null || isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(c.locale, {
      style: "currency", currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 2 : value >= 1000 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : 8,
    }).format(value);
  } catch (e) {
    return (c.symbol || "") + Number(value).toFixed(2);
  }
}

/* ---------- live price store (for terminal + ticker) ---------- */
class PriceStore {
  constructor() {
    this.quotes = {};          // id -> {price, change24h, vol, t}
    this.listeners = new Set();
    this.ids = [];
    this.vs = "eur";
    this.timer = null;
    this.lastUpdate = 0;
    this.error = null;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((f) => f()); }
  configure(ids, vs, intervalMs = 20000) {
    const changed = ids.join() !== this.ids.join() || vs !== this.vs;
    this.ids = ids; this.vs = vs;
    if (changed) this.refresh(true);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(false), intervalMs);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async refresh(force) {
    if (!this.ids.length) return;
    try {
      const r = await getSimplePrices(this.ids, [this.vs]);
      const now = Date.now();
      for (const id of this.ids) {
        const q = r.data[id];
        if (q && q[this.vs] != null) {
          this.quotes[id] = {
            price: q[this.vs],
            change24h: q[`${this.vs}_24h_change`],
            vol: q[`${this.vs}_24h_vol`],
            t: now,
          };
        }
      }
      this.lastUpdate = now;
      this.error = r.stale ? "Rate limited — showing cached prices." : null;
      this.emit();
    } catch (e) {
      this.error = "Live feed unavailable — retrying.";
      this.emit();
    }
  }
  price(id) { return this.quotes[id] ? this.quotes[id].price : null; }
}
export const priceStore = new PriceStore();
