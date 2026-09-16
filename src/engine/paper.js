/* ============================================================
   Vertex Trader — Paper Trading Engine (original code)
   Executes virtual orders against REAL live prices (CoinGecko).
   Spot + isolated-margin futures with liquidation + DCA bots.
   This is the one allowed "demo" surface: virtual funds only.
   ============================================================ */
import { priceStore, CURRENCIES } from "../services/coingecko.js";

const SPOT_FEE = 0.001;        // 0.10%
const FUTURES_FEE = 0.0005;    // 0.05% taker
const SPREAD_BPS = 4;          // execution spread around real mid (paper fill model)
const MMR = 0.005;             // maintenance margin ratio
const START_FIAT = { EUR: 50000, USD: 0, GBP: 0, NGN: 0 };
const LIVE_FIAT = { EUR: 0, USD: 0, GBP: 0, NGN: 0 };
const EQUITY_SNAPSHOT_MS = 60e3;

const LS = (owner, mode = "live") => `vt_paper_v4:${mode}:${owner}`;

class PaperEngine {
  constructor() {
    this.owner = "guest";
    this.mode = "live";
    this.coinMeta = {};       // id -> {symbol, name, image}
    this.listeners = new Set();
    this.toastQ = [];
    this.state = null;
    this._unsub = null;
    this._lastSnap = 0;
  }

  init(owner = "guest", mode = "live") {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    this.owner = owner || "guest";
    this.mode = mode === "demo" ? "demo" : "live";
    this.state = this.load();
    // live price updates drive matching/mark-to-market
    this._unsub = priceStore.subscribe(() => this.onPrices());
    this.loadMeta();
    this.emit();
  }

  load() {
    try {
      const raw = localStorage.getItem(LS(this.owner));
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.balances) {
          s.positions = s.positions || [];
          s.dcas = s.dcas || [];
          s.alerts = s.alerts || [];
          s.equityHistory = s.equityHistory || [];
          return s;
        }
      }
    } catch (e) { /* reset below */ }
    return {
      balances: { fiat: { ...(this.mode === "demo" ? START_FIAT : LIVE_FIAT) }, coins: {} },
      fiat: "EUR",
      orders: [], history: [], positions: [], dcas: [], alerts: [],
      equityHistory: [], nextId: 1, leverage: 5,
      startedAt: Date.now(),
    };
  }
  save() { try { localStorage.setItem(LS(this.owner, this.mode), JSON.stringify(this.state)); } catch (e) { /* quota */ } }

  async loadMeta() {
    try {
      const raw = localStorage.getItem("vt_coin_meta_v1");
      if (raw) this.coinMeta = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }
  setCoinMeta(list) {
    list.forEach((c) => { this.coinMeta[c.id] = { symbol: (c.symbol || "").toUpperCase(), name: c.name, image: c.image }; });
    try { localStorage.setItem("vt_coin_meta_v1", JSON.stringify(this.coinMeta)); } catch (e) { /* quota */ }
  }
  meta(coinId) { return this.coinMeta[coinId] || { symbol: (coinId || "?").toUpperCase(), name: coinId, image: null }; }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((f) => f()); }
  toast(msg, err = false) { this.toastQ.push({ msg, err, id: Date.now() + Math.random() }); this.emit(); }

  setFiat(f) {
    if (CURRENCIES[f]) { this.state.fiat = f; this.save(); this.emit(); }
  }
  setLeverage(l) { this.state.leverage = l; this.save(); this.emit(); }

  price(coinId) { return priceStore.price(coinId); }
  execPrice(coinId, side) {
    const mid = this.price(coinId);
    if (mid == null) return null;
    const adj = mid * (SPREAD_BPS / 10000) * (side === "buy" || side === "long" ? 0.5 : -0.5);
    return mid + adj;
  }

  fiatBal() { return this.state.balances.fiat[this.state.fiat] || 0; }
  coinBal(coinId) { return this.state.balances.coins[`${coinId}:${this.state.fiat}`] || this.state.balances.coins[coinId] || 0; }
  addCoin(coinId, qty) { this.state.balances.coins[coinId] = (this.state.balances.coins[coinId] || 0) + qty; }
  subCoin(coinId, qty) { this.state.balances.coins[coinId] = (this.state.balances.coins[coinId] || 0) - qty; }

  equity() {
    let eq = 0;
    for (const [f, amt] of Object.entries(this.state.balances.fiat)) {
      // convert non-base fiat roughly via EUR cross from store where possible
      if (f === this.state.fiat) eq += amt;
      else eq += amt * this.fxTo(f, this.state.fiat);
    }
    for (const [id, qty] of Object.entries(this.state.balances.coins)) {
      const p = this.price(id);
      if (p != null) eq += qty * p;
    }
    for (const pos of this.state.positions) eq += pos.margin + this.uPnl(pos);
    return eq;
  }
  fxTo(from, to) {
    if (from === to) return 1;
    // derive cross from EUR-based quotes when available
    const pf = priceStore.quotes["bitcoin"] ? null : null; // placeholder no-op
    try {
      const rates = JSON.parse(localStorage.getItem("vt_fx_v1") || "{}");
      if (rates[from] && rates[to]) return rates[to] / rates[from];
    } catch (e) { /* ignore */ }
    return 1; // unknown cross: treat at par (virtual wallet)
    void pf;
  }

  snapshotEquity(force = false) {
    const now = Date.now();
    if (!force && now - this._lastSnap < EQUITY_SNAPSHOT_MS) return;
    const eq = this.equity();
    const h = this.state.equityHistory;
    if (!h.length || now - h[h.length - 1].t > EQUITY_SNAPSHOT_MS / 2) {
      h.push({ t: now, eq });
      if (h.length > 4000) h.shift();
      this._lastSnap = now;
      this.save();
    }
  }

  /* ---------- price-driven lifecycle ---------- */
  onPrices() {
    if (!this.state) return;
    this.checkLimits();
    this.checkLiquidations();
    this.runDCAs();
    this.checkAlerts();
    this.snapshotEquity();
    this.emit();
  }

  checkLimits() {
    let changed = false;
    this.state.orders = this.state.orders.filter((o) => {
      const mid = this.price(o.coinId);
      if (mid == null) return true;
      const filled = (o.side === "buy" && mid <= o.price) || (o.side === "sell" && mid >= o.price);
      if (!filled) return true;
      this.settleSpot(o, o.price, "limit");
      changed = true;
      return false;
    });
    if (changed) this.save();
  }

  settleSpot(o, px, type) {
    const cost = o.qty * px;
    const fee = cost * SPOT_FEE;
    if (o.side === "buy") this.addCoin(o.coinId, o.qty);
    else this.state.balances.fiat[o.fiat] = (this.state.balances.fiat[o.fiat] || 0) + cost - fee;
    this.state.history.unshift({ id: o.id, kind: "spot", coinId: o.coinId, fiat: o.fiat, side: o.side, type, qty: o.qty, price: px, fee, time: Date.now() });
    if (this.state.history.length > 200) this.state.history.pop();
    const sym = this.meta(o.coinId).symbol;
    this.toast(`${type === "limit" ? "Limit" : "Market"} ${o.side.toUpperCase()} filled · ${o.qty.toPrecision(6)} ${sym} @ ${px.toPrecision(6)} ${o.fiat}`);
    this.snapshotEquity(true);
  }

  checkLiquidations() {
    let changed = false;
    this.state.positions = this.state.positions.filter((p) => {
      const mid = this.price(p.coinId);
      if (mid == null || p.status !== "open") return true;
      p.uPnl = this.uPnl(p);
      const hit = p.side === "long" ? mid <= p.liqPrice : mid >= p.liqPrice;
      if (!hit) return true;
      p.status = "liquidated";
      p.closedAt = Date.now();
      p.closePrice = mid;
      this.state.history.unshift({ id: this.state.nextId++, kind: "liquidation", coinId: p.coinId, fiat: p.fiat, side: p.side, qty: p.qty, price: mid, margin: p.margin, leverage: p.leverage, loss: -p.margin, time: Date.now() });
      this.toast(`⚠ Position LIQUIDATED · ${this.meta(p.coinId).symbol} ${p.side} — margin of ${p.margin.toFixed(2)} ${p.fiat} lost.`, true);
      changed = true;
      return false;
    });
    if (changed) { this.save(); this.snapshotEquity(true); }
  }

  uPnl(p) {
    const mid = this.price(p.coinId);
    if (mid == null) return p.uPnl || 0;
    return (mid - p.entry) * p.qty * (p.side === "long" ? 1 : -1);
  }
  roe(p) {
    const u = this.uPnl(p);
    return p.margin > 0 ? (u / p.margin) * 100 : 0;
  }

  runDCAs() {
    const now = Date.now();
    let changed = false;
    for (const d of this.state.dcas) {
      if (!d.active) continue;
      const mid = this.price(d.coinId);
      if (mid == null) continue;
      if (d.remaining > 0 && now >= d.nextRun) {
        const cost = d.fiatAmount * (1 + SPOT_FEE);
        if ((this.state.balances.fiat[d.fiat] || 0) >= cost) {
          const px = this.execPrice(d.coinId, "buy");
          this.state.balances.fiat[d.fiat] -= cost;
          const qty = (d.fiatAmount * (1 - SPREAD_BPS / 20000)) / px;
          this.addCoin(d.coinId, qty);
          d.boughtQty += qty; d.spent += d.fiatAmount; d.remaining -= 1;
          d.avgPrice = d.spent / d.boughtQty;
          d.buys.push({ t: now, qty, price: px });
          d.nextRun = now + d.everyMin * 60e3;
          this.state.history.unshift({ id: this.state.nextId++, kind: "dca", coinId: d.coinId, fiat: d.fiat, side: "buy", type: "dca", qty, price: px, fee: d.fiatAmount * SPOT_FEE, time: now });
          this.toast(`DCA buy #${d.buys.length} · ${qty.toPrecision(5)} ${this.meta(d.coinId).symbol} @ ${px.toPrecision(6)}`);
          changed = true;
        } else {
          d.active = false; d.pausedReason = "Insufficient fiat balance";
          this.toast(`DCA paused — insufficient ${d.fiat} balance.`, true);
          changed = true;
        }
      }
      if (d.remaining <= 0 && d.takeProfitPct && d.boughtQty > 0 && mid >= d.avgPrice * (1 + d.takeProfitPct / 100)) {
        const px = this.execPrice(d.coinId, "sell");
        const proceeds = d.boughtQty * px * (1 - SPOT_FEE);
        this.subCoin(d.coinId, d.boughtQty);
        this.state.balances.fiat[d.fiat] = (this.state.balances.fiat[d.fiat] || 0) + proceeds;
        this.state.history.unshift({ id: this.state.nextId++, kind: "dca-tp", coinId: d.coinId, fiat: d.fiat, side: "sell", type: "take-profit", qty: d.boughtQty, price: px, fee: d.boughtQty * px * SPOT_FEE, time: now });
        this.toast(`🎯 DCA take-profit hit · sold ${d.boughtQty.toPrecision(5)} ${this.meta(d.coinId).symbol} at +${d.takeProfitPct}%`);
        d.active = false; d.completed = true; d.boughtQty = 0;
        changed = true;
      }
    }
    if (changed) { this.save(); this.snapshotEquity(true); }
  }

  checkAlerts() {
    const remaining = [];
    let changed = false;
    for (const a of this.state.alerts) {
      const mid = this.price(a.coinId);
      const hit = mid != null && ((a.dir === "above" && mid >= a.price) || (a.dir === "below" && mid <= a.price));
      if (hit) {
        this.toast(`🔔 Alert: ${this.meta(a.coinId).symbol} is ${a.dir} ${a.price.toPrecision(6)} ${a.fiat} (now ${mid.toPrecision(6)})`);
        this.state.history.unshift({ id: this.state.nextId++, kind: "alert", coinId: a.coinId, fiat: a.fiat, side: a.dir, qty: 0, price: mid, time: Date.now() });
        changed = true;
      } else remaining.push(a);
    }
    if (changed) { this.state.alerts = remaining; this.save(); }
  }

  /* ---------- spot ---------- */
  placeSpotOrder({ coinId, side, mode, qty, price }) {
    qty = Number(qty);
    if (!qty || qty <= 0) { this.toast("Enter a valid amount.", true); return false; }
    const mid = this.price(coinId);
    if (mid == null) { this.toast("Waiting for live price data…", true); return false; }
    const fiat = this.state.fiat;
    const px = mode === "limit" ? Number(price) : this.execPrice(coinId, side);
    if (!px || px <= 0) { this.toast("Enter a valid limit price.", true); return false; }
    const cost = qty * px;
    const fee = cost * SPOT_FEE;
    const id = this.state.nextId++;

    if (side === "buy") {
      if (this.fiatBal() < cost + fee) { this.toast(`Insufficient ${fiat} — need ${(cost + fee).toFixed(2)}, have ${this.fiatBal().toFixed(2)}.`, true); return false; }
      this.state.balances.fiat[fiat] -= cost + fee;
      if (mode === "market") {
        this.settleSpot({ id, coinId, fiat, side, qty }, px, "market");
      } else {
        this.state.orders.unshift({ id, kind: "spot", coinId, fiat, side, mode, price: px, qty, time: Date.now(), status: "open" });
        this.toast(`Limit BUY placed @ ${px.toPrecision(6)} ${fiat} — funds reserved.`);
      }
    } else {
      if (this.coinBal(coinId) < qty) { this.toast(`Insufficient ${this.meta(coinId).symbol} — have ${this.coinBal(coinId).toPrecision(6)}.`, true); return false; }
      this.subCoin(coinId, qty);
      if (mode === "market") {
        this.settleSpot({ id, coinId, fiat, side, qty }, px, "market");
      } else {
        this.state.orders.unshift({ id, kind: "spot", coinId, fiat, side, mode, price: px, qty, time: Date.now(), status: "open" });
        this.toast(`Limit SELL placed @ ${px.toPrecision(6)} ${fiat} — assets reserved.`);
      }
    }
    this.save();
    this.emit();
    return true;
  }

  cancelOrder(id) {
    const o = this.state.orders.find((x) => x.id === id);
    if (!o) return;
    if (o.side === "buy") this.state.balances.fiat[o.fiat] = (this.state.balances.fiat[o.fiat] || 0) + o.qty * o.price * (1 + SPOT_FEE);
    else this.addCoin(o.coinId, o.qty);
    this.state.orders = this.state.orders.filter((x) => x.id !== id);
    this.toast(`Order #${id} cancelled — funds released.`);
    this.save();
    this.emit();
  }

  /* ---------- swap (wallet-style) ---------- */
  swap(from, to, amt) {
    // from/to are asset codes: fiat code or coinId
    amt = Number(amt);
    if (!amt || amt <= 0) { this.toast("Enter an amount to swap.", true); return false; }
    const isFiat = (a) => !!CURRENCIES[a];
    const val = (a) => (isFiat(a) ? (a === from ? amt : 0) : 0);
    void val;
    // resolve unit values in current fiat
    const fiat = this.state.fiat;
    const unitValue = (a) => {
      if (a === fiat) return 1;
      if (isFiat(a)) return this.fxTo(a, fiat);
      return this.price(a);
    };
    const fromV = unitValue(from), toV = unitValue(to);
    if (fromV == null || toV == null) { this.toast("Waiting for live price data…", true); return false; }
    const have = isFiat(from) ? (this.state.balances.fiat[from] || 0) : this.coinBal(from);
    if (have < amt) { this.toast(`Insufficient ${isFiat(from) ? from : this.meta(from).symbol} — have ${Number(have).toPrecision(6)}.`, true); return false; }
    const recvGross = (amt * fromV) / toV;
    const recv = recvGross * (1 - SPOT_FEE);
    if (isFiat(from)) this.state.balances.fiat[from] -= amt; else this.subCoin(from, amt);
    if (isFiat(to)) this.state.balances.fiat[to] = (this.state.balances.fiat[to] || 0) + recv; else this.addCoin(to, recv);
    const rate = fromV / toV;
    this.state.history.unshift({ id: this.state.nextId++, kind: "swap", from, to, coinId: !isFiat(to) ? to : from, fiat, side: "swap", type: "swap", qty: amt, price: rate, fee: recvGross * SPOT_FEE, time: Date.now() });
    this.toast(`Swapped ${amt.toPrecision(6)} ${isFiat(from) ? from : this.meta(from).symbol} → ${recv.toPrecision(6)} ${isFiat(to) ? to : this.meta(to).symbol}`);
    this.save();
    this.snapshotEquity(true);
    this.emit();
    return true;
  }

  /* ---------- futures ---------- */
  openPosition({ coinId, side, margin, leverage }) {
    margin = Number(margin); leverage = Number(leverage);
    if (!margin || margin <= 0) { this.toast("Enter your margin amount.", true); return false; }
    if (![1, 2, 3, 5, 10, 20, 50].includes(leverage)) { this.toast("Choose a valid leverage.", true); return false; }
    if (this.fiatBal() < margin) { this.toast(`Insufficient ${this.state.fiat} for margin.`, true); return false; }
    const px = this.execPrice(coinId, side);
    if (px == null) { this.toast("Waiting for live price data…", true); return false; }
    const openFee = margin * leverage * FUTURES_FEE;
    if (this.fiatBal() < margin + openFee) { this.toast(`Margin + opening fee exceeds balance.`, true); return false; }
    this.state.balances.fiat[this.state.fiat] -= margin + openFee;
    const notional = margin * leverage;
    const qty = notional / px;
    const liqPrice = side === "long" ? px * (1 - 1 / leverage + MMR) : px * (1 + 1 / leverage - MMR);
    const pos = {
      id: this.state.nextId++, kind: "futures", coinId, fiat: this.state.fiat,
      side, leverage, margin, qty, entry: px, liqPrice: Math.max(liqPrice, 0),
      openFee, status: "open", openedAt: Date.now(), uPnl: 0,
    };
    this.state.positions.unshift(pos);
    this.state.history.unshift({ id: this.state.nextId++, kind: "futures-open", coinId, fiat: this.state.fiat, side, qty, price: px, margin, leverage, fee: openFee, time: Date.now() });
    this.toast(`${side.toUpperCase()} opened · ${qty.toPrecision(5)} ${this.meta(coinId).symbol} @ ${px.toPrecision(6)} · ${leverage}x · liq ≈ ${liqPrice.toPrecision(6)}`);
    this.save();
    this.emit();
    return true;
  }

  closePosition(id) {
    const p = this.state.positions.find((x) => x.id === id);
    if (!p || p.status !== "open") return;
    const mid = this.price(p.coinId);
    if (mid == null) return this.toast("Waiting for live price data…", true);
    const closePx = this.execPrice(p.coinId, p.side === "long" ? "sell" : "buy");
    const u = (closePx - p.entry) * p.qty * (p.side === "long" ? 1 : -1);
    const closeFee = p.qty * closePx * FUTURES_FEE;
    const returned = Math.max(0, p.margin + u - closeFee);
    this.state.balances.fiat[p.fiat] = (this.state.balances.fiat[p.fiat] || 0) + returned;
    p.status = "closed"; p.closedAt = Date.now(); p.closePrice = closePx; p.realized = u - closeFee;
    this.state.positions = this.state.positions.filter((x) => x.id !== id);
    this.state.history.unshift({ id: this.state.nextId++, kind: "futures-close", coinId: p.coinId, fiat: p.fiat, side: p.side, qty: p.qty, price: closePx, margin: p.margin, leverage: p.leverage, pnl: u - closeFee, fee: closeFee, time: Date.now() });
    this.toast(`Position closed · ${u >= 0 ? "+" : ""}${u.toFixed(2)} ${p.fiat} realized P&L`);
    this.save();
    this.snapshotEquity(true);
    this.emit();
  }

  /* ---------- DCA ---------- */
  createDCA({ coinId, fiatAmount, everyMin, totalBuys, takeProfitPct }) {
    fiatAmount = Number(fiatAmount); everyMin = Number(everyMin); totalBuys = Math.min(500, Math.max(2, Number(totalBuys) || 0));
    if (!fiatAmount || fiatAmount <= 0) return this.toast("Enter the amount per buy.", true);
    if (!everyMin || everyMin < 1) return this.toast("Interval must be at least 1 minute.", true);
    if (!totalBuys || totalBuys < 2) return this.toast("Set at least 2 buys.", true);
    if (this.fiatBal() < fiatAmount) return this.toast(`Insufficient ${this.state.fiat} for the first buy.`, true);
    const d = {
      id: this.state.nextId++, coinId, fiat: this.state.fiat,
      fiatAmount, everyMin, totalBuys, remaining: totalBuys,
      takeProfitPct: takeProfitPct ? Number(takeProfitPct) : null,
      active: true, completed: false, pausedReason: null,
      boughtQty: 0, spent: 0, avgPrice: 0, buys: [],
      nextRun: Date.now(), createdAt: Date.now(),
    };
    this.state.dcas.unshift(d);
    this.toast(`DCA started · ${fiatAmount} ${this.state.fiat} into ${this.meta(coinId).symbol} every ${everyMin}m × ${totalBuys}`);
    this.save();
    this.emit();
    this.runDCAs();
  }
  stopDCA(id) {
    const d = this.state.dcas.find((x) => x.id === id);
    if (!d) return;
    d.active = false;
    this.toast("DCA stopped. Purchases already made remain in your wallet.");
    this.save();
    this.emit();
  }

  /* ---------- alerts ---------- */
  addAlert(coinId, dir, price) {
    price = Number(price);
    if (!price || price <= 0) return this.toast("Enter a valid alert price.", true);
    this.state.alerts.unshift({ id: this.state.nextId++, coinId, fiat: this.state.fiat, dir, price });
    this.toast(`Alert set: ${this.meta(coinId).symbol} ${dir} ${price.toPrecision(6)} ${this.state.fiat}.`);
    this.save();
    this.emit();
  }
  removeAlert(id) { this.state.alerts = this.state.alerts.filter((a) => a.id !== id); this.save(); this.emit(); }

  /* ---------- funding (virtual wallet top-ups & withdrawals) ---------- */
  deposit({ asset, amount }) {
    amount = Number(amount);
    if (!asset) return this.toast("Choose an asset to deposit.", true);
    if (!amount || amount <= 0) return this.toast("Enter a valid amount to deposit.", true);
    if (amount > 10_000_000) return this.toast("Single virtual deposits are capped at 10,000,000.", true);
    const fiat = !!CURRENCIES[asset];
    if (fiat) this.state.balances.fiat[asset] = (this.state.balances.fiat[asset] || 0) + amount;
    else this.state.balances.coins[asset] = (this.state.balances.coins[asset] || 0) + amount;
    this.state.history.unshift({ id: this.state.nextId++, kind: "deposit", coinId: fiat ? null : asset, fiat: asset, side: "in", qty: amount, price: fiat ? 1 : (this.price(asset) || 0), time: Date.now() });
    this.toast(`↓ Deposited ${amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${fiat ? asset : this.meta(asset).symbol} into your wallet.`);
    this.save(); this.emit(); this.snapshotEquity(true);
    return true;
  }

  withdraw({ asset, amount }) {
    amount = Number(amount);
    if (!asset) return this.toast("Choose an asset to withdraw.", true);
    if (!amount || amount <= 0) return this.toast("Enter a valid amount to withdraw.", true);
    const fiat = !!CURRENCIES[asset];
    const have = fiat ? (this.state.balances.fiat[asset] || 0) : this.coinBal(asset);
    if (have + 1e-9 < amount) return this.toast(`Insufficient ${fiat ? asset : this.meta(asset).symbol} — available ${Number(have).toPrecision(6)}.`, true);
    if (fiat) this.state.balances.fiat[asset] = have - amount;
    else this.state.balances.coins[asset] = (this.state.balances.coins[asset] || 0) - amount;
    this.state.history.unshift({ id: this.state.nextId++, kind: "withdraw", coinId: fiat ? null : asset, fiat: asset, side: "out", qty: amount, price: fiat ? 1 : (this.price(asset) || 0), time: Date.now() });
    this.toast(`↑ Withdrew ${amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${fiat ? asset : this.meta(asset).symbol} out of your wallet.`);
    this.save(); this.emit(); this.snapshotEquity(true);
    return true;
  }

  reset() {
    try { localStorage.removeItem(LS(this.owner, this.mode)); } catch (e) { /* ignore */ }
    this.state = this.load();
    this.toast(this.mode === "demo" ? "Demo wallet reset to €50,000 practice funds." : "Live wallet cleared.");
    this.save();
    this.emit();
  }
}

export const paper = new PaperEngine();
export { PaperEngine, SPOT_FEE, FUTURES_FEE, SPREAD_BPS, MMR, START_FIAT };
