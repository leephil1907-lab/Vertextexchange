import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import CandleChart from "../components/CandleChart.jsx";
import { useApp } from "../app-context.jsx";
import { paper, SPOT_FEE, FUTURES_FEE, MMR } from "../engine/paper.js";
import { getMarkets, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";
import { fetchCandles, TIMEFRAMES, applyLivePrice } from "../services/candles.js";

const LEVS = [1, 2, 3, 5, 10, 20, 50];
const fmtN = (n, p = 6) => (n == null ? "—" : Number(n).toPrecision(p));
const fmtT = (t) => new Date(t).toLocaleTimeString("en-GB", { hour12: false });

/* ---------------- toasts ---------------- */
function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const drain = () => {
      if (!paper.toastQ.length) return;
      const batch = paper.toastQ.splice(0, paper.toastQ.length);
      setItems((cur) => [...cur, ...batch].slice(-4));
      batch.forEach((t) => setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 4200));
    };
    const unsub = paper.subscribe(drain);
    drain();
    return unsub;
  }, []);
  return (
    <div className="toasts">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} className={"toast" + (t.err ? " err" : "")}
            initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- main ---------------- */
export default function Trade() {
  const { fiat, setFiat, theme, user, sessionMode, setSessionMode } = useApp();
  const vs = CURRENCIES[fiat].vs;
  const [params, setParams] = useSearchParams();

  const [coins, setCoins] = useState([]);
  const [coinId, setCoinId] = useState(params.get("coin") || "bitcoin");
  const [tf, setTf] = useState("15m");
  const [candles, setCandles] = useState([]);
  const [chartState, setChartState] = useState("loading");
  const [inds, setInds] = useState({
    ema20: (params.get("ind") || "").includes("ema"),
    ema50: (params.get("ind") || "").includes("ema"),
    rsi: (params.get("ind") || "").includes("rsi"),
    macd: (params.get("ind") || "").includes("macd"),
    volume: true,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(params.get("tab") === "futures" ? "futures" : params.get("tab") === "dca" ? "dca" : params.get("tab") === "swap" ? "swap" : "spot");
  const [bottomTab, setBottomTab] = useState("positions");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertDir, setAlertDir] = useState("above");
  const [alertPx, setAlertPx] = useState("");
  const [, force] = useState(0);
  const chartRef = useRef(null);

  // spot form
  const [side, setSide] = useState("buy");
  const [mode, setMode] = useState("market");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [pct, setPct] = useState(0);
  // futures form
  const [fSide, setFSide] = useState("long");
  const [lev, setLev] = useState(paper.state?.leverage || 5);
  const [margin, setMargin] = useState("");
  // swap
  const [swapFrom, setSwapFrom] = useState("EUR");
  const [swapTo, setSwapTo] = useState("bitcoin");
  const [swapAmt, setSwapAmt] = useState("");
  // dca
  const [dcaAmt, setDcaAmt] = useState("");
  const [dcaEvery, setDcaEvery] = useState("60");
  const [dcaBuys, setDcaBuys] = useState("10");
  const [dcaTp, setDcaTp] = useState("");

  /* coin universe: top 100 real markets */
  useEffect(() => {
    getMarkets(vs, 1, 100).then((r) => {
      if (Array.isArray(r.data)) {
        setCoins(r.data);
        paper.setCoinMeta(r.data);
      }
    }).catch(() => { });
  }, [vs]);

  /* live price feed for visible coins */
  useEffect(() => {
    const ids = [coinId, ...coins.slice(0, 24).map((c) => c.id)].filter((v, i, a) => a.indexOf(v) === i);
    priceStore.configure(ids, vs, 15000);
  }, [coinId, coins, vs]);

  useEffect(() => paper.subscribe(() => force((v) => v + 1)), []);

  /* candles */
  useEffect(() => {
    let alive = true;
    setChartState("loading");
    fetchCandles(coinId, vs, tf).then((r) => {
      if (!alive) return;
      setCandles([...r.candles]);
      setChartState(r.stale ? "stale" : "ok");
    }).catch(() => alive && setChartState("error"));
    return () => { alive = false; };
  }, [coinId, vs, tf]);

  useEffect(() => {
    const bucketMs = TIMEFRAMES.find((t) => t.id === tf)?.bucketMs || 900e3;
    return priceStore.subscribe(() => {
      const p = priceStore.price(coinId);
      if (!p) return;
      setCandles((prev) => (prev.length ? [...applyLivePrice(prev.map((c) => ({ ...c })), bucketMs, p)] : prev));
    });
  }, [coinId, tf]);

  /* order + alert price lines on chart */
  const priceLines = useMemo(() => {
    if (!paper.state) return [];
    return [
      ...paper.state.orders.filter((o) => o.coinId === coinId).map((o) => ({ price: o.price, color: o.side === "buy" ? "#0ca678" : "#e5484d", title: `${o.side} ${fmtN(o.qty, 4)}` })),
      ...paper.state.alerts.filter((a) => a.coinId === coinId).map((a) => ({ price: a.price, color: "#f59e0b", style: "dotted", title: `🔔 ${a.dir}` })),
    ];
  }, [coinId, paper.state?.orders, paper.state?.alerts, force]);
  useEffect(() => { chartRef.current?.setPriceLines?.(priceLines); }, [priceLines]);

  const st = paper.state;
  if (!st) return <div className="spinner" />;
  const meta = paper.meta(coinId);
  const sym = meta.symbol || coinId.toUpperCase();
  const px = priceStore.price(coinId);
  const coinRow = coins.find((c) => c.id === coinId);
  const chg24 = coinRow?.price_change_percentage_24h ?? priceStore.quotes[coinId]?.change24h ?? 0;

  const execPx = (s) => paper.execPrice(coinId, s);
  const refPx = mode === "limit" ? (parseFloat(price) || px) : execPx(side === "buy" ? "buy" : "sell");
  const qtyN = parseFloat(qty) || 0;
  const total = qtyN * (refPx || 0);
  const equity = paper.equity();
  const pnl = equity - (st.equityHistory[0]?.eq ?? equity);

  const futEntry = execPx(fSide === "long" ? "buy" : "sell") || px;
  const marginN = parseFloat(margin) || 0;
  const futQty = futEntry ? (marginN * lev) / futEntry : 0;
  const futLiq = futEntry ? (fSide === "long" ? futEntry * (1 - 1 / lev + MMR) : futEntry * (1 + 1 / lev - MMR)) : 0;

  const swapUnit = (a) => (CURRENCIES[a] ? (a === fiat ? 1 : 1) : priceStore.price(a));
  const swapRate = swapUnit(swapFrom) != null && swapUnit(swapTo) != null && swapUnit(swapTo) !== 0 ? swapUnit(swapFrom) / swapUnit(swapTo) : null;
  const swapRecv = swapRate && parseFloat(swapAmt) ? parseFloat(swapAmt) * swapRate * (1 - SPOT_FEE) : null;

  const assets = [fiat, "USD", "EUR", "GBP", "NGN"].filter((v, i, a) => a.indexOf(v) === i).concat(coins.slice(0, 24).map((c) => c.id));
  const assetLabel = (a) => (CURRENCIES[a] ? a : paper.meta(a).symbol || a.toUpperCase());
  const assetBal = (a) => (CURRENCIES[a] ? st.balances.fiat[a] || 0 : paper.coinBal(a));

  const submitSpot = () => { paper.placeSpotOrder({ coinId, side, mode, qty, price }); setQty(""); setPct(0); };
  const onSlider = (v) => {
    setPct(v);
    const p = refPx || 0;
    const maxQ = side === "buy" ? (p ? paper.fiatBal() / (p * (1 + SPOT_FEE)) : 0) : paper.coinBal(coinId);
    setQty(maxQ * v / 100 > 0 ? Number((maxQ * v / 100).toPrecision(6)) : "");
  };

  const visibleCoins = coins.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase())).slice(0, 40);

  return (
    <section style={{ paddingTop: 22 }}>
      <div className="term-container">
        <div className="term-banner">
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="mode-switch" role="tablist" aria-label="Trading session mode">
              <button type="button" role="tab" aria-selected={sessionMode === "live"} className={sessionMode === "live" ? "active live" : ""} onClick={() => setSessionMode("live")}>● LIVE</button>
              <button type="button" role="tab" aria-selected={sessionMode === "demo"} className={sessionMode === "demo" ? "active demo" : ""} onClick={() => setSessionMode("demo")}>◑ DEMO</button>
            </span>
            {sessionMode === "live" ? (
              <span>Live session — trading against your <b>funded balance</b> with prices <b>live from CoinGecko</b>. {!user ? <Link to="/signup" style={{ color: "var(--accent)", fontWeight: 700 }}>Sign up to sync your account →</Link> : <Link to="/funding" style={{ color: "var(--accent)", fontWeight: 700 }}>Fund your wallet →</Link>}</span>
            ) : (
              <span>Demo session — practising with <b>separate demo funds</b> at the same live prices. Your live balance is untouched.</span>
            )}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            {sessionMode === "demo" && (
              <button type="button" onClick={() => { if (confirm("Reset your DEMO wallet, orders, positions and history? Your live wallet is not affected.")) paper.reset(); }}>Reset demo wallet</button>
            )}
          </span>
        </div>

        {/* top bar */}
        <div className="panel term-top">
          <div style={{ position: "relative" }}>
            <button className="pair-btn" type="button" onClick={() => setMenuOpen(!menuOpen)}>
              {coinRow && <img src={coinRow.image} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />}
              {sym}/{fiat} <span className="caret">▾</span>
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div className="pair-menu" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
                  <input autoFocus placeholder="Search live markets…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {visibleCoins.map((c) => (
                      <div className="pitem" key={c.id} onClick={() => { setCoinId(c.id); setSwapTo(c.id); setMenuOpen(false); setSearch(""); setParams({ coin: c.id }); }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}><img src={c.image} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} />{c.symbol.toUpperCase()}<small style={{ color: "var(--muted)", fontWeight: 400 }}>{c.name}</small></span>
                        <span className="p-px tnum">{fmtMoney(c.current_price, fiat)}</span>
                      </div>
                    ))}
                    {!visibleCoins.length && <div className="empty-state">No matches.</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div>
            <motion.div key={px} initial={{ opacity: 0.45 }} animate={{ opacity: 1 }} className={"last-px tnum " + (chg24 >= 0 ? "up" : "down")}>
              {px != null ? fmtMoney(px, fiat) : "—"}
            </motion.div>
            <div className="term-stat" style={{ marginTop: 2 }}>
              24h <b className={"tnum " + (chg24 >= 0 ? "up" : "down")} style={{ display: "inline" }}>{chg24 >= 0 ? "+" : ""}{(chg24 ?? 0).toFixed(2)}%</b>
              {coinRow && <> · cap {fmtMoney(coinRow.market_cap, fiat, true)}</>}
            </div>
          </div>
          <div className="term-stat">Wallet ({fiat})<b className="tnum">{fmtMoney(paper.fiatBal(), fiat)}</b></div>
          <div className="term-stat">Equity<b className="tnum">{fmtMoney(equity, fiat)}</b></div>
          <div className="term-stat">Session P&L<b className={"tnum " + (pnl >= 0 ? "up" : "down")}>{pnl >= 0 ? "+" : ""}{fmtMoney(pnl, fiat)}</b></div>
          <div className="term-stat" style={{ marginLeft: "auto" }}>Feed<b style={{ color: chartState === "ok" ? "var(--accent)" : "var(--gold)" }}>{chartState === "ok" ? "● live" : chartState === "stale" ? "cached" : chartState === "error" ? "reconnecting" : "loading"}</b></div>
        </div>

        <div className="term-grid" onClick={() => menuOpen && setMenuOpen(false)}>
          {/* chart */}
          <div className="panel panel-chart">
            <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
              <h3>{sym}/{fiat} · real candles</h3>
              <div className="tf-group">
                {TIMEFRAMES.map((t) => <button key={t.id} className={tf === t.id ? "active" : ""} onClick={() => setTf(t.id)}>{t.label}</button>)}
                <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
                {[["ema20", "EMA20"], ["ema50", "EMA50"], ["rsi", "RSI"], ["macd", "MACD"]].map(([k, l]) => (
                  <button key={k} className={"ind-btn" + (inds[k] ? " on" : "")} onClick={() => setInds((s) => ({ ...s, [k]: !s[k] }))}>{l}</button>
                ))}
                <button className={"ind-btn" + (alertsOpen ? " on" : "")} onClick={() => setAlertsOpen(!alertsOpen)}>🔔</button>
              </div>
            </div>
            <AnimatePresence>
              {alertsOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>Alert when {sym}:</span>
                    <select value={alertDir} onChange={(e) => setAlertDir(e.target.value)} className="pill" style={{ padding: "6px 10px" }}>
                      <option value="above">goes above</option><option value="below">drops below</option>
                    </select>
                    <input value={alertPx} onChange={(e) => setAlertPx(e.target.value)} placeholder={px != null ? fmtN(px) : "price"} type="number" step="any"
                      style={{ width: 130, background: "rgba(5,8,15,.25)", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 10px", borderRadius: 999, outline: "none", font: "600 13px var(--font)" }} />
                    <button className="btn btn-ghost" style={{ padding: "6px 16px", fontSize: 13 }} onClick={() => { paper.addAlert(coinId, alertDir, alertPx || px); setAlertPx(""); }}>Set alert</button>
                    {st.alerts.filter((a) => a.coinId === coinId).map((a) => (
                      <span className="alert-row" key={a.id} style={{ margin: 0 }}>🔔 {a.dir} {fmtN(a.price)}
                        <button onClick={() => paper.removeAlert(a.id)} style={{ background: "none", border: "none", color: "var(--down)", cursor: "pointer" }}>✕</button>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {chartState === "error"
              ? <div className="empty-state" style={{ padding: 90 }}>Chart feed unavailable (CoinGecko rate limit). The order panel still works with live prices — retry the chart shortly.</div>
              : <CandleChart ref={chartRef} candles={candles} theme={theme} height={400} indicators={inds} />}
          </div>

          {/* market info column */}
          <div className="panel">
            <div className="panel-head"><h3>{sym} market</h3><span style={{ color: "var(--muted)", fontSize: 11.5 }}>CoinGecko live</span></div>
            <div style={{ padding: 14 }}>
              {(coinRow ? [
                ["Price", fmtMoney(coinRow.current_price, fiat)],
                ["24h change", `${(coinRow.price_change_percentage_24h ?? 0).toFixed(2)}%`],
                ["1h change", `${(coinRow.price_change_percentage_1h_in_currency ?? 0).toFixed(2)}%`],
                ["7d change", `${(coinRow.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%`],
                ["24h volume", fmtMoney(coinRow.total_volume, fiat, true)],
                ["Market cap", fmtMoney(coinRow.market_cap, fiat, true)],
                ["Circulating", (coinRow.circulating_supply ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " " + sym],
                ["Rank", "#" + (coinRow.market_cap_rank ?? "—")],
              ] : [["Price", px != null ? fmtMoney(px, fiat) : "—"]]).map(([l, v], i) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 2px", borderBottom: i < 7 ? "1px solid var(--line)" : "none", fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>{l}</span><b className="tnum">{v}</b>
                </div>
              ))}
              <Link className="more" to={`/coin/${coinId}`}>Full coin analysis →</Link>
            </div>
            <div className="panel-head" style={{ borderTop: "1px solid var(--line)" }}><h3>Your {sym}</h3></div>
            <div style={{ padding: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px" }}><span style={{ color: "var(--muted)" }}>Wallet balance</span><b className="tnum">{fmtN(paper.coinBal(coinId))} {sym}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px" }}><span style={{ color: "var(--muted)" }}>Value</span><b className="tnum">{fmtMoney(paper.coinBal(coinId) * (px || 0), fiat)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px" }}><span style={{ color: "var(--muted)" }}>Open positions</span><b className="tnum">{st.positions.filter((p) => p.coinId === coinId).length}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px" }}><span style={{ color: "var(--muted)" }}>Open orders</span><b className="tnum">{st.orders.filter((o) => o.coinId === coinId).length}</b></div>
            </div>
          </div>

          {/* order entry */}
          <div className="panel">
            <div className="order-tabs">
              {[["spot", "Spot"], ["futures", "Futures"], ["swap", "Swap"], ["dca", "DCA"]].map(([k, l]) => (
                <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === "spot" && (
              <div className="order-body">
                <div className="side-btns">
                  <button className={"buy " + (side === "buy" ? "active" : "")} onClick={() => setSide("buy")}>Buy {sym}</button>
                  <button className={"sell " + (side === "sell" ? "active" : "")} onClick={() => setSide("sell")}>Sell {sym}</button>
                </div>
                <div className="seg">
                  <button className={mode === "market" ? "active" : ""} onClick={() => { setMode("market"); setPrice(""); }}>Market</button>
                  <button className={mode === "limit" ? "active" : ""} onClick={() => { setMode("limit"); if (!price && px) setPrice(fmtN(px)); }}>Limit</button>
                </div>
                <div className="term-field"><label>Price {mode === "market" && <span style={{ color: "var(--accent)" }}>live best</span>}</label>
                  <div className="term-input"><input type="number" step="any" value={price} disabled={mode === "market"} placeholder={px != null ? fmtN(px) : "—"} onChange={(e) => setPrice(e.target.value)} /><span className="suffix">{fiat}</span></div>
                </div>
                <div className="term-field"><label>Amount</label>
                  <div className="term-input"><input type="number" step="any" min="0" value={qty} placeholder="0.00" onChange={(e) => { setQty(e.target.value); setPct(0); }} /><span className="suffix">{sym}</span></div>
                </div>
                <div className="slider-row">
                  <input type="range" min="0" max="100" step="5" value={pct} aria-label="Percent of available balance"
                    style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, var(--bg-elev) ${pct}%)` }}
                    onChange={(e) => onSlider(parseInt(e.target.value, 10))} />
                  <span className="pct tnum">{pct}%</span>
                </div>
                <div className="pct-chips">
                  {[0, 25, 50, 75, 100].map((v) => (
                    <button key={v} type="button" className={pct === v ? "active" : ""} onClick={() => onSlider(v)}>{v === 0 ? "Min" : v + "%"}</button>
                  ))}
                </div>
                <div className="avail-row tnum"><span>Available</span>{side === "buy" ? <b>{fmtMoney(paper.fiatBal(), fiat)}</b> : <b>{fmtN(paper.coinBal(coinId))} {sym}</b>}</div>
                <div className="order-summary tnum">
                  <div><span>Fill price (incl. spread)</span><b>{refPx ? fmtN(refPx) : "—"}</b></div>
                  <div><span>Fee (0.10%)</span><b>{fmtMoney(total * SPOT_FEE, fiat)}</b></div>
                  <div><span>Total</span><b>{fmtMoney(total + (side === "buy" ? total * SPOT_FEE : -total * SPOT_FEE), fiat)}</b></div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className={"btn btn-block btn-lg " + (side === "buy" ? "btn-buy" : "btn-sell")} onClick={submitSpot} disabled={px == null}>
                  {px == null ? "Waiting for live price…" : `${side === "buy" ? "Buy" : "Sell"} ${sym}`}
                </motion.button>
                <p style={{ color: "var(--faint)", fontSize: 11.5, marginTop: 12, textAlign: "center" }}>Limit orders rest until the live price crosses them — plotted on the chart.</p>
              </div>
            )}

            {tab === "futures" && (
              <div className="order-body">
                <div className="side-btns">
                  <button className={"buy " + (fSide === "long" ? "active" : "")} onClick={() => setFSide("long")}>Long {sym}</button>
                  <button className={"sell " + (fSide === "short" ? "active" : "")} onClick={() => setFSide("short")}>Short {sym}</button>
                </div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Leverage (isolated margin)</label>
                <div className="lev-group">
                  {LEVS.map((l) => <button key={l} className={lev === l ? "active" : ""} onClick={() => { setLev(l); paper.setLeverage(l); }}>{l}x</button>)}
                </div>
                <div className="term-field"><label>Margin</label>
                  <div className="term-input"><input type="number" step="any" min="0" value={margin} placeholder="0.00" onChange={(e) => setMargin(e.target.value)} /><span className="suffix">{fiat}</span></div>
                </div>
                <div className="slider-row">
                  <input type="range" min="0" max="100" step="5" value={pct} aria-label="Percent of balance used as margin"
                    style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, var(--bg-elev) ${pct}%)` }}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); setPct(v); setMargin(Number((paper.fiatBal() * v / 100).toPrecision(6)) || ""); }} />
                  <span className="pct tnum">{pct}%</span>
                </div>
                <div className="pct-chips">
                  {[0, 25, 50, 75, 100].map((v) => (
                    <button key={v} type="button" className={pct === v ? "active" : ""} onClick={() => { setPct(v); setMargin(Number((paper.fiatBal() * v / 100).toPrecision(6)) || ""); }}>{v === 0 ? "Min" : v + "%"}</button>
                  ))}
                </div>
                <div className="order-summary tnum">
                  <div><span>Entry (est.)</span><b>{futEntry ? fmtN(futEntry) : "—"}</b></div>
                  <div><span>Position size</span><b>{fmtN(marginN * lev, 4)} {fiat} · {fmtN(futQty, 5)} {sym}</b></div>
                  <div><span>Opening fee (0.05%)</span><b>{fmtMoney(marginN * lev * FUTURES_FEE, fiat)}</b></div>
                  <div><span>Est. liquidation</span><b style={{ color: "var(--down)" }}>{futLiq ? fmtN(futLiq) : "—"}</b></div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className={"btn btn-block btn-lg " + (fSide === "long" ? "btn-buy" : "btn-sell")}
                  disabled={px == null || !marginN}
                  onClick={() => { paper.openPosition({ coinId, side: fSide, margin, leverage: lev }); setMargin(""); setPct(0); }}>
                  {px == null ? "Waiting for live price…" : `Open ${fSide} · ${lev}x`}
                </motion.button>
                <p className="liq-warn" style={{ marginTop: 12, textAlign: "center" }}>
                  ⚠ At {lev}x, a {(100 / lev - MMR * 100).toFixed(1)}% adverse move liquidates the full margin. Futures are the highest-risk mode — practise here first.
                </p>
              </div>
            )}

            {tab === "swap" && (
              <div className="order-body">
                <div className="term-field">
                  <label><span>You pay</span><span className="tnum">Balance: {fmtN(assetBal(swapFrom), 5)} {assetLabel(swapFrom)}</span></label>
                  <div className="term-input">
                    <input type="number" step="any" min="0" placeholder="0.00" value={swapAmt} onChange={(e) => setSwapAmt(e.target.value)} />
                    <select value={swapFrom} onChange={(e) => setSwapFrom(e.target.value)}>{assets.map((a) => <option key={a} value={a}>{assetLabel(a)}</option>)}</select>
                  </div>
                </div>
                <div className="swap-arrow"><button type="button" onClick={() => { const f = swapFrom; setSwapFrom(swapTo); setSwapTo(f); }}>⇅</button></div>
                <div className="term-field">
                  <label>You receive (after 0.10% fee)</label>
                  <div className="term-input">
                    <input type="number" step="any" readOnly placeholder="0.00" value={swapRecv != null ? Number(swapRecv.toPrecision(6)) : ""} />
                    <select value={swapTo} onChange={(e) => setSwapTo(e.target.value)}>{assets.map((a) => <option key={a} value={a}>{assetLabel(a)}</option>)}</select>
                  </div>
                </div>
                <div className="order-summary tnum">
                  <div><span>Rate (live)</span><b>{swapRate != null ? `1 ${assetLabel(swapFrom)} ≈ ${fmtN(swapRate)} ${assetLabel(swapTo)}` : "—"}</b></div>
                  <div><span>Route</span><b>Direct · virtual settlement</b></div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="btn btn-block btn-lg btn-buy"
                  disabled={!swapRecv} onClick={() => { paper.swap(swapFrom, swapTo, swapAmt); setSwapAmt(""); }}>
                  Swap
                </motion.button>
                <p style={{ color: "var(--faint)", fontSize: 11.5, marginTop: 12, textAlign: "center" }}>Wallet-style conversion between fiat and coins at live CoinGecko rates.</p>
              </div>
            )}

            {tab === "dca" && (
              <div className="order-body">
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                  Dollar-cost averaging: buy <b>{sym}</b> automatically at fixed intervals using the live price. Optional take-profit sells your DCA stack automatically.
                </p>
                <div className="term-field"><label>Amount per buy</label>
                  <div className="term-input"><input type="number" step="any" min="0" value={dcaAmt} placeholder={`e.g. 50`} onChange={(e) => setDcaAmt(e.target.value)} /><span className="suffix">{fiat}</span></div>
                </div>
                <div className="term-field"><label>Interval</label>
                  <div className="term-input">
                    <select value={dcaEvery} onChange={(e) => setDcaEvery(e.target.value)}>
                      {[[1, "Every 1 minute (fast)"], [5, "Every 5 minutes"], [15, "Every 15 minutes"], [60, "Every hour"], [1440, "Every day"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="term-field"><label>Total buys</label>
                  <div className="term-input"><input type="number" min="2" max="500" value={dcaBuys} onChange={(e) => setDcaBuys(e.target.value)} /><span className="suffix">orders</span></div>
                </div>
                <div className="term-field"><label>Take-profit % (optional)</label>
                  <div className="term-input"><input type="number" min="0" step="0.5" value={dcaTp} placeholder="e.g. 10" onChange={(e) => setDcaTp(e.target.value)} /><span className="suffix">%</span></div>
                </div>
                <div className="order-summary tnum">
                  <div><span>Total commitment</span><b>{fmtMoney((parseFloat(dcaAmt) || 0) * (parseInt(dcaBuys) || 0), fiat)}</b></div>
                  <div><span>Wallet ({fiat})</span><b>{fmtMoney(paper.fiatBal(), fiat)}</b></div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="btn btn-block btn-lg btn-buy" disabled={!parseFloat(dcaAmt)}
                  onClick={() => { paper.createDCA({ coinId, fiatAmount: dcaAmt, everyMin: dcaEvery, totalBuys: dcaBuys, takeProfitPct: dcaTp }); setDcaAmt(""); }}>
                  Start DCA bot
                </motion.button>
                {st.dcas.filter((d) => d.coinId === coinId).length > 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12, textAlign: "center" }}>Bots for {sym} are listed in the panel below.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* bottom panel */}
        <div className="panel">
          <div className="bottom-tabs">
            {[["positions", `Positions ${st.positions.length ? `(${st.positions.length})` : ""}`], ["orders", `Open orders ${st.orders.length ? `(${st.orders.length})` : ""}`], ["dcas", `DCA bots ${st.dcas.length ? `(${st.dcas.length})` : ""}`], ["history", "History"], ["balances", "Balances"], ["alerts", `Alerts ${st.alerts.length ? `(${st.alerts.length})` : ""}`]].map(([k, l]) => (
              <button key={k} className={bottomTab === k ? "active" : ""} onClick={() => setBottomTab(k)}>{l}</button>
            ))}
          </div>
          <div className="bottom-body">
            {bottomTab === "positions" && (st.positions.length === 0
              ? <div className="empty-state">No open futures positions. Open one from the Futures tab — margin, mark price, ROE and liquidation are tracked live.</div>
              : <table className="data" style={{ minWidth: 860 }}>
                <thead><tr><th>Market</th><th>Side</th><th className="num">Size</th><th className="num">Entry</th><th className="num">Mark</th><th className="num">Liq. price</th><th className="num">Margin</th><th className="num">uPnL ({fiat})</th><th className="num">ROE</th><th className="num">Action</th></tr></thead>
                <tbody>
                  {st.positions.map((p) => {
                    const mark = priceStore.price(p.coinId);
                    const u = paper.uPnl(p);
                    const roe = paper.roe(p);
                    const liqDist = mark && p.liqPrice ? Math.abs((mark - p.liqPrice) / mark) * 100 : null;
                    return (
                      <tr key={p.id} className="pos-row">
                        <td><b>{paper.meta(p.coinId).symbol}/{p.fiat}</b> <span className="badge badge-new">{p.leverage}x</span></td>
                        <td className={p.side === "long" ? "up" : "down"}><b>{p.side.toUpperCase()}</b></td>
                        <td className="num tnum">{fmtN(p.qty, 5)}</td>
                        <td className="num tnum">{fmtN(p.entry)}</td>
                        <td className="num tnum">{mark ? fmtN(mark) : "—"}</td>
                        <td className="num tnum" style={{ color: "var(--down)" }}>{fmtN(p.liqPrice)}{liqDist != null && liqDist < 5 && <span className="liq-warn"> ⚠ {liqDist.toFixed(1)}% away</span>}</td>
                        <td className="num tnum">{p.margin.toFixed(2)}</td>
                        <td className={"num tnum " + (u >= 0 ? "up" : "down")}>{u >= 0 ? "+" : ""}{u.toFixed(2)}</td>
                        <td className={"num tnum " + (roe >= 0 ? "up" : "down")}>{roe >= 0 ? "+" : ""}{roe.toFixed(1)}%</td>
                        <td className="num"><button className="cancel-btn" onClick={() => paper.closePosition(p.id)}>Close</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>)}
            {bottomTab === "orders" && (st.orders.length === 0
              ? <div className="empty-state">No open limit orders. Orders rest here (funds reserved) until the live price crosses them.</div>
              : <table className="data" style={{ minWidth: 760 }}>
                <thead><tr><th>Time</th><th>Market</th><th>Side</th><th className="num">Limit price</th><th className="num">Amount</th><th className="num">Total</th><th className="num">Action</th></tr></thead>
                <tbody>{st.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="tnum">{fmtT(o.time)}</td>
                    <td><b>{paper.meta(o.coinId).symbol}/{o.fiat}</b></td>
                    <td className={o.side === "buy" ? "up" : "down"}>{o.side.toUpperCase()}</td>
                    <td className="num tnum">{fmtN(o.price)}</td>
                    <td className="num tnum">{fmtN(o.qty, 5)}</td>
                    <td className="num tnum">{(o.qty * o.price).toFixed(2)}</td>
                    <td className="num"><button className="cancel-btn" onClick={() => paper.cancelOrder(o.id)}>Cancel</button></td>
                  </tr>))}
                </tbody>
              </table>)}
            {bottomTab === "dcas" && (st.dcas.length === 0
              ? <div className="empty-state">No DCA bots yet. Configure one in the DCA tab — it buys at live prices on schedule.</div>
              : <div style={{ padding: 14 }}>
                {st.dcas.map((d) => (
                  <div className="alert-row" key={d.id} style={{ padding: "10px 12px" }}>
                    <span>
                      🤖 <b>{paper.meta(d.coinId).symbol}</b> · {d.fiatAmount} {d.fiat} every {d.everyMin < 60 ? `${d.everyMin}m` : d.everyMin === 60 ? "1h" : "1d"}
                      · buys {d.totalBuys - d.remaining}/{d.totalBuys}
                      {d.avgPrice > 0 && <> · avg {fmtN(d.avgPrice)}{d.takeProfitPct ? ` · TP +${d.takeProfitPct}%` : ""}</>}
                      {!d.active && <b style={{ color: d.completed ? "var(--accent)" : "var(--gold)" }}> {d.completed ? "✓ completed" : "· stopped" + (d.pausedReason ? ` (${d.pausedReason})` : "")}</b>}
                    </span>
                    {d.active && <button className="cancel-btn" onClick={() => paper.stopDCA(d.id)}>Stop</button>}
                  </div>
                ))}
              </div>)}
            {bottomTab === "history" && (st.history.length === 0
              ? <div className="empty-state">No activity yet — your fills, liquidations, swaps and DCA buys appear here.</div>
              : <table className="data" style={{ minWidth: 760 }}>
                <thead><tr><th>Time</th><th>Kind</th><th>Market</th><th>Side</th><th className="num">Price</th><th className="num">Amount</th><th className="num">Fee / PnL</th></tr></thead>
                <tbody>{st.history.slice(0, 50).map((h) => (
                  <tr key={h.id + "-" + h.time}>
                    <td className="tnum">{fmtT(h.time)}</td>
                    <td><span className="badge badge-new">{h.kind}</span></td>
                    <td><b>{h.coinId ? paper.meta(h.coinId).symbol : (h.from + "→" + h.to)}</b></td>
                    <td className={h.side === "buy" || h.side === "long" ? "up" : h.side === "sell" || h.side === "short" ? "down" : ""}>{String(h.side).toUpperCase()}{h.leverage ? ` ${h.leverage}x` : ""}</td>
                    <td className="num tnum">{fmtN(h.price)}</td>
                    <td className="num tnum">{fmtN(h.qty, 5)}</td>
                    <td className={"num tnum " + (h.pnl != null ? (h.pnl >= 0 ? "up" : "down") : "")}>{h.pnl != null ? `${h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}` : (h.fee != null ? h.fee.toFixed(2) : h.loss != null ? h.loss.toFixed(2) : "—")}</td>
                  </tr>))}
                </tbody>
              </table>)}
            {bottomTab === "balances" && (() => {
              const fiatRows = Object.entries(st.balances.fiat).filter(([, v]) => v !== 0 || true);
              const coinRows = Object.entries(st.balances.coins).filter(([, v]) => v > 0);
              const val = ([id, q]) => (priceStore.price(id) || 0) * q;
              const total = fiatRows.reduce((s, [, v]) => s + v * (v === st.fiat ? 1 : 0), 0) + coinRows.reduce((s, c) => s + val(c), 0)
                + st.positions.reduce((s, p) => s + p.margin + paper.uPnl(p), 0);
              return (
                <table className="data" style={{ minWidth: 560 }}>
                  <thead><tr><th>Asset</th><th className="num">Balance</th><th className="num">Value ({fiat})</th><th className="num">Allocation</th></tr></thead>
                  <tbody>
                    {fiatRows.map(([f, v]) => (
                      <tr key={f}><td><b>{f}</b> {f === st.fiat && <span className="badge badge-pop">base</span>}</td><td className="num tnum">{v.toFixed(2)}</td><td className="num tnum">{(v * (f === st.fiat ? 1 : 0)).toFixed(2)}</td><td className="num tnum">{total > 0 && f === st.fiat ? ((v / total) * 100).toFixed(1) + "%" : "—"}</td></tr>
                    ))}
                    {coinRows.map(([id, q]) => (
                      <tr key={id}>
                        <td><span className="coin-id" style={{ gap: 8 }}>{paper.meta(id).image && <img src={paper.meta(id).image} alt="" style={{ width: 20, height: 20 }} />}<b>{paper.meta(id).symbol}</b></span></td>
                        <td className="num tnum">{fmtN(q)}</td>
                        <td className="num tnum">{(val([id, q])).toFixed(2)}</td>
                        <td className="num tnum">{total > 0 ? ((val([id, q]) / total) * 100).toFixed(1) + "%" : "—"}</td>
                      </tr>
                    ))}
                    {st.positions.length > 0 && (
                      <tr><td><b>Futures margin + uPnL</b></td><td className="num">—</td>
                        <td className="num tnum">{st.positions.reduce((s, p) => s + p.margin + paper.uPnl(p), 0).toFixed(2)}</td>
                        <td className="num tnum">{total > 0 ? ((st.positions.reduce((s, p) => s + p.margin + paper.uPnl(p), 0) / total) * 100).toFixed(1) + "%" : "—"}</td></tr>
                    )}
                    <tr style={{ background: "var(--bg-elev)" }}><td><b>Total equity</b></td><td className="num">—</td><td className="num tnum"><b>{total.toFixed(2)}</b></td><td className="num tnum">100%</td></tr>
                  </tbody>
                </table>
              );
            })()}
            {bottomTab === "alerts" && (st.alerts.length === 0
              ? <div className="empty-state">No price alerts. Use 🔔 above the chart or set one from any coin page.</div>
              : <div style={{ padding: 16 }}>
                {st.alerts.map((a) => (
                  <div className="alert-row" key={a.id}>
                    <span>🔔 <b>{paper.meta(a.coinId).symbol}</b> {a.dir} <b className="tnum">{fmtN(a.price)}</b> {a.fiat} · now <span className="tnum">{priceStore.price(a.coinId) ? fmtN(priceStore.price(a.coinId)) : "—"}</span></span>
                    <button className="cancel-btn" onClick={() => paper.removeAlert(a.id)}>Remove</button>
                  </div>
                ))}
              </div>)}
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: 26 }}>
          {[
            ["Live prices, real mechanics", "Every quote comes from CoinGecko's live API. Orders, margin and liquidation are computed against those real prices — on your funded balance in a live session, or on separate practice funds in a demo session."],
            ["Isolated-margin futures", "Choose 1x–50x, see entry, size, fees and estimated liquidation before you commit. Positions mark to the live price with ROE, and liquidate automatically when the math says so."],
            ["DCA on autopilot", "Schedule recurring buys at live prices with optional take-profit. Watch the bot work, then stop it whenever you like — purchased coins stay in your wallet."],
          ].map(([h, p], i) => (
            <motion.div key={h} className="card" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
              <h3>{h}</h3><p>{p}</p>
            </motion.div>
          ))}
        </div>
        <div style={{ textAlign: "center", margin: "30px 0 10px" }}>
          <Link className="btn btn-ghost" to="/strategies">Not sure what to do first? Follow the step-by-step guide →</Link>
        </div>
      </div>
      <Toasts />
    </section>
  );
}
