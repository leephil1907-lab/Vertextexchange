import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Reveal, Section, Btn } from "../components/ui.jsx";
import CandleChart from "../components/CandleChart.jsx";
import { useApp } from "../app-context.jsx";
import { getCoin, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";
import { fetchCandles, TIMEFRAMES, applyLivePrice } from "../services/candles.js";
import { paper } from "../engine/paper.js";

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = String(html || "").replace(/<a[^>]*>/gi, "").replace(/<\/a>/gi, "");
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

export default function CoinDetail() {
  const { id } = useParams();
  const { fiat, theme } = useApp();
  const vs = CURRENCIES[fiat].vs;
  const [coin, setCoin] = useState(null);
  const [error, setError] = useState(null);
  const [tf, setTf] = useState("1H");
  const [candles, setCandles] = useState([]);
  const [chartState, setChartState] = useState("loading");
  const [inds, setInds] = useState({ ema20: true, ema50: false, rsi: false, macd: false, volume: true });
  const [, force] = useState(0);
  const [alertDir, setAlertDir] = useState("above");
  const [alertPx, setAlertPx] = useState("");

  useEffect(() => {
    let alive = true;
    setCoin(null); setError(null);
    getCoin(id, vs).then((r) => { if (alive) setCoin(r.data); })
      .catch(() => alive && setError("Could not load this coin from CoinGecko (rate limit or unknown id). Try again shortly."));
    return () => { alive = false; };
  }, [id, vs]);

  useEffect(() => {
    if (coin) priceStore.configure([id], vs, 15000);
  }, [coin, id, vs]);

  useEffect(() => {
    let alive = true;
    setChartState("loading");
    fetchCandles(id, vs, tf).then((r) => {
      if (!alive) return;
      setCandles([...r.candles]);
      setChartState(r.stale ? "stale" : "ok");
    }).catch(() => alive && setChartState("error"));
    return () => { alive = false; };
  }, [id, vs, tf]);

  // live candle updates from real price polls
  useEffect(() => {
    const bucketMs = TIMEFRAMES.find((t) => t.id === tf)?.bucketMs || 3600e3;
    return priceStore.subscribe(() => {
      const p = priceStore.price(id);
      if (!p) return;
      setCandles((prev) => (prev.length ? [...applyLivePrice(prev.map((c) => ({ ...c })), bucketMs, p)] : prev));
      force((v) => v + 1);
    });
  }, [id, tf]);

  const md = coin?.market_data;
  const livePx = priceStore.price(id);
  const px = livePx ?? md?.current_price?.[vs];
  const chg24 = md?.price_change_percentage_24h ?? 0;

  const stats = useMemo(() => {
    if (!md) return [];
    return [
      ["Market cap", fmtMoney(md.market_cap?.[vs], fiat, true), `Rank #${coin.market_cap_rank ?? "—"}`],
      ["24h high / low", `${fmtMoney(md.high_24h?.[vs], fiat)} / ${fmtMoney(md.low_24h?.[vs], fiat)}`, "rolling 24 hours"],
      ["24h volume", fmtMoney(md.total_volume?.[vs], fiat, true), `${(md.volume_to_market_cap_ratio ?? 0).toFixed(3)}× of cap`],
      ["Fully diluted valuation", md.fully_diluted_valuation?.[vs] ? fmtMoney(md.fully_diluted_valuation[vs], fiat, true) : "—", "at max supply"],
      ["Circulating supply", md.circulating_supply ? md.circulating_supply.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " " + coin.symbol.toUpperCase() : "—", md.max_supply ? `Max: ${md.max_supply.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "No max supply"],
      ["All-time high", fmtMoney(md.ath?.[vs], fiat), `${(md.ath_change_percentage?.[vs] ?? 0).toFixed(1)}% from ATH · ${new Date(md.ath_date?.[vs]).toLocaleDateString()}`],
      ["All-time low", fmtMoney(md.atl?.[vs], fiat), `${(md.atl_change_percentage?.[vs] ?? 0).toFixed(0)}% above ATL · ${new Date(md.atl_date?.[vs]).toLocaleDateString()}`],
      ["7d / 30d change", `${(md.price_change_percentage_7d ?? 0).toFixed(2)}% / ${(md.price_change_percentage_30d ?? 0).toFixed(2)}%`, "trend snapshot"],
    ];
  }, [md, vs, fiat, coin]);

  if (error) {
    return (
      <Section><div className="container" style={{ textAlign: "center", padding: "80px 0" }}>
        <h2 style={{ marginBottom: 12 }}>⚠ {error}</h2>
        <Btn to="/markets" className="btn btn-ghost">← Back to markets</Btn>
      </div></Section>
    );
  }
  if (!coin) {
    return (
      <Section><div className="container">
        <div className="skeleton" style={{ height: 90, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 440, marginBottom: 20 }} />
        <div className="stat-grid">{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90 }} />)}</div>
      </div></Section>
    );
  }

  const desc = stripHtml(coin.description?.en).slice(0, 900);

  return (
    <>
      <section style={{ paddingTop: 30 }}>
        <div className="container" style={{ width: "min(1440px, 94%)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            <Link to="/">Home</Link> / <Link to="/markets">Markets</Link> / {coin.name}
          </div>
          <Reveal style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <img src={coin.image?.large} alt="" style={{ width: 46, height: 46, borderRadius: "50%" }} />
            <div>
              <h1 style={{ fontSize: 28, letterSpacing: "-.02em" }}>{coin.name} <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 600 }}>{coin.symbol?.toUpperCase()} · Rank #{coin.market_cap_rank ?? "—"}</span></h1>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <motion.div key={px} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} className={"tnum " + (chg24 >= 0 ? "up" : "down")} style={{ fontSize: 30, fontWeight: 900 }}>
                {px != null ? fmtMoney(px, fiat) : "—"}
              </motion.div>
              <div className={"tnum " + (chg24 >= 0 ? "up" : "down")} style={{ fontWeight: 700, fontSize: 14 }}>
                {chg24 >= 0 ? "▲" : "▼"} {Math.abs(chg24).toFixed(2)}% (24h) · live via CoinGecko
              </div>
            </div>
          </Reveal>

          <Reveal className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-head" style={{ flexWrap: "wrap", gap: 10 }}>
              <h3>{coin.symbol?.toUpperCase()}/{fiat} · real market data</h3>
              <div className="tf-group">
                {TIMEFRAMES.map((t) => (
                  <button key={t.id} className={tf === t.id ? "active" : ""} onClick={() => setTf(t.id)}>{t.label}</button>
                ))}
                <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
                {[["ema20", "EMA20"], ["ema50", "EMA50"], ["rsi", "RSI"], ["macd", "MACD"]].map(([k, l]) => (
                  <button key={k} className={"ind-btn" + (inds[k] ? " on" : "")} onClick={() => setInds((s) => ({ ...s, [k]: !s[k] }))}>{l}</button>
                ))}
                <span style={{ fontSize: 11.5, color: chartState === "ok" ? "var(--accent)" : "var(--gold)", marginLeft: 6 }}>
                  {chartState === "loading" ? "loading…" : chartState === "stale" ? "cached data" : chartState === "error" ? "feed error" : "● live"}
                </span>
              </div>
            </div>
            {chartState === "error"
              ? <div className="empty-state">Chart data unavailable right now — CoinGecko free-tier rate limit. Try another timeframe shortly.</div>
              : <CandleChart candles={candles} theme={theme} height={430} indicators={inds} />}
          </Reveal>

          <div className="stat-grid" style={{ marginBottom: 22 }}>
            {stats.map(([l, v, s], i) => (
              <Reveal key={l} delay={i * 0.04} className="stat-cell">
                <div className="l">{l}</div>
                <div className="v tnum" style={{ fontSize: 15.5 }}>{v}</div>
                <div className="l" style={{ marginTop: 2 }}>{s}</div>
              </Reveal>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 22 }} className="coin-split">
            <Reveal className="card">
              <h3>About {coin.name}</h3>
              <p style={{ marginTop: 10 }}>{desc ? desc + (stripHtml(coin.description?.en).length > 900 ? "…" : "") : "No description provided by the data source."}</p>
              {coin.categories?.filter(Boolean).length > 0 && (
                <div className="pill-row" style={{ marginTop: 16 }}>
                  {coin.categories.filter(Boolean).slice(0, 6).map((c) => <span className="pill" key={c}>{c}</span>)}
                </div>
              )}
              <div className="pill-row" style={{ marginTop: 16 }}>
                {coin.links?.homepage?.[0] && <a className="pill" href={coin.links.homepage[0]} target="_blank" rel="noreferrer">🌐 Website</a>}
                {coin.links?.blockchain_site?.[0] && <a className="pill" href={coin.links.blockchain_site[0]} target="_blank" rel="noreferrer">🔎 Explorer</a>}
                {coin.links?.repos_url?.github?.[0] && <a className="pill" href={coin.links.repos_url.github[0]} target="_blank" rel="noreferrer">💻 GitHub</a>}
              </div>
              {coin.sentiment_votes_up_percentage != null && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                    <span>Community sentiment (CoinGecko votes)</span>
                    <span className="tnum">{coin.sentiment_votes_up_percentage.toFixed(0)}% bullish</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: "var(--bg-elev)", overflow: "hidden" }}>
                    <div style={{ width: coin.sentiment_votes_up_percentage + "%", height: "100%", background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
                  </div>
                </div>
              )}
            </Reveal>

            <div>
              <Reveal className="card" style={{ marginBottom: 18 }}>
                <h3>Trade {coin.symbol?.toUpperCase()}</h3>
                <p style={{ margin: "8px 0 16px" }}>Open the terminal with this market pre-selected — spot, futures and DCA with live prices.</p>
                <Link className="btn btn-primary btn-block" to={`/trade?coin=${coin.id}`}>Launch terminal →</Link>
              </Reveal>
              <Reveal className="card" delay={0.08}>
                <h3>🔔 Price alert</h3>
                <p style={{ margin: "8px 0 14px" }}>Get notified when {coin.symbol?.toUpperCase()} crosses a level.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={alertDir} onChange={(e) => setAlertDir(e.target.value)} className="pill" style={{ padding: "7px 10px" }}>
                    <option value="above">Goes above</option><option value="below">Drops below</option>
                  </select>
                  <input value={alertPx} onChange={(e) => setAlertPx(e.target.value)} type="number" step="any" placeholder={px != null ? Number(px).toPrecision(6) : "price"}
                    style={{ width: 120, background: "rgba(5,8,15,.25)", border: "1px solid var(--line)", color: "var(--text)", padding: "7px 10px", borderRadius: 999, outline: "none", font: "600 13px var(--font)" }} />
                  <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }}
                    onClick={() => { paper.addAlert(id, alertDir, alertPx || px); setAlertPx(""); }}>Set alert</button>
                </div>
              </Reveal>
            </div>
          </div>
          <style>{`@media(max-width:980px){.coin-split{grid-template-columns:1fr !important}}`}</style>
        </div>
      </section>
      <div style={{ height: 60 }} />
    </>
  );
}
