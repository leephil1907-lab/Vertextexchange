import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Reveal, Section, PageHero } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { getMarkets, getGlobal, CURRENCIES, fmtMoney } from "../services/coingecko.js";
import Sparkline from "../components/Sparkline.jsx";

const SORTS = {
  rank: (a, b) => a.market_cap_rank - b.market_cap_rank,
  price: (a, b) => b.current_price - a.current_price,
  chg1h: (a, b) => (b.price_change_percentage_1h_in_currency ?? -999) - (a.price_change_percentage_1h_in_currency ?? -999),
  chg24h: (a, b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999),
  chg7d: (a, b) => (b.price_change_percentage_7d_in_currency ?? -999) - (a.price_change_percentage_7d_in_currency ?? -999),
  mcap: (a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0),
  vol: (a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0),
};

const pct = (v) => v == null ? <span style={{ color: "var(--faint)" }}>—</span> : (
  <span className={"tnum " + (v >= 0 ? "up" : "down")}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</span>
);

export default function Markets() {
  const { fiat, setFiat } = useApp();
  const vs = CURRENCIES[fiat].vs;
  const [pages, setPages] = useState(1);
  const [coins, setCoins] = useState(null);
  const [status, setStatus] = useState({ age: null, stale: false, error: null });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rank");
  const [desc, setDesc] = useState(false);
  const [g, setG] = useState(null);

  useEffect(() => { getGlobal().then((r) => setG(r.data.data)).catch(() => { }); }, []);

  useEffect(() => {
    let alive = true;
    const load = async (p) => {
      setStatus((s) => ({ ...s, error: null }));
      try {
        const results = [];
        for (let i = 1; i <= p; i++) results.push(await getMarkets(vs, i, 100));
        if (!alive) return;
        const all = results.flatMap((r) => r.data || []);
        setCoins(all);
        const last = results[results.length - 1];
        setStatus({ age: last.age, stale: !!last.stale, error: last.stale ? "CoinGecko rate limit — showing cached prices." : null });
      } catch (e) {
        if (alive) setStatus({ age: null, stale: true, error: "Could not reach CoinGecko. Retrying…" });
      }
    };
    setCoins(null);
    load(pages);
    const t = setInterval(() => load(pages), 60000);
    return () => { alive = false; clearInterval(t); };
  }, [vs, pages]);

  const rows = useMemo(() => {
    if (!coins) return null;
    let list = coins;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s) || c.symbol.toLowerCase().includes(s));
    }
    list = [...list].sort(SORTS[sort] || SORTS.rank);
    if (desc) list.reverse();
    return list;
  }, [coins, q, sort, desc]);

  const th = (key, label, num) => (
    <th className={num ? "num" : ""} style={{ cursor: "pointer", userSelect: "none" }}
      onClick={() => { if (sort === key) setDesc(!desc); else { setSort(key); setDesc(false); } }}>
      {label} {sort === key ? (desc ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <>
      <PageHero crumb="Markets" title="Live crypto markets" text="Real-time prices, changes, volumes and 7-day sparklines for the top coins — served live by the CoinGecko API in your chosen currency." />
      <Section>
        <div className="container" style={{ width: "min(1440px, 94%)" }}>
          <Reveal className="mkt-globals">
            {[
              ["Global market cap", g ? fmtMoney(g.total_market_cap?.[vs], fiat, true) : "…",
                g ? <span className={(g.market_cap_change_percentage_24h_usd ?? 0) >= 0 ? "up" : "down"}>{(g.market_cap_change_percentage_24h_usd ?? 0) >= 0 ? "+" : ""}{(g.market_cap_change_percentage_24h_usd ?? 0).toFixed(2)}% 24h</span> : null],
              ["24h volume", g ? fmtMoney(g.total_volume?.[vs], fiat, true) : "…", null],
              ["BTC dominance", g ? (g.market_cap_percentage?.btc ?? 0).toFixed(1) + "%" : "…", null],
              ["Coins tracked", g ? (g.active_cryptocurrencies ?? 0).toLocaleString("en-US") : "…", null],
            ].map(([l, v, x], i) => (
              <div className={"mg-cell" + (i ? " bordered" : "")} key={l}>
                <div className="mg-label">{l}</div>
                <div className="mg-value tnum">{v}{x && <span className="mg-extra">{x}</span>}</div>
              </div>
            ))}
          </Reveal>
          <Reveal className="market-toolbar">
            <input placeholder="Search name or symbol…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="cur-select">
              {Object.keys(CURRENCIES).map((c) => (
                <button key={c} className={fiat === c ? "active" : ""} onClick={() => setFiat(c)}>{c}</button>
              ))}
            </div>
            <div className="data-status">
              <span className="pulse-dot" style={{ background: status.stale ? "var(--gold)" : "var(--accent)" }} />
              {status.error ? status.error : status.age != null ? `CoinGecko · updated ${Math.max(1, Math.round(status.age / 1000))}s ago · auto-refresh 60s` : "Connecting to CoinGecko…"}
            </div>
          </Reveal>

          {!rows ? (
            <div>
              {[...Array(10)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}
            </div>
          ) : (
            <Reveal className="table-wrap">
              <table className="data" style={{ minWidth: 1080 }}>
                <thead>
                  <tr>
                    {th("rank", "#")}
                    <th>Coin</th>
                    {th("price", "Price", true)}
                    {th("chg1h", "1h %", true)}
                    {th("chg24h", "24h %", true)}
                    {th("chg7d", "7d %", true)}
                    {th("mcap", "Market Cap", true)}
                    {th("vol", "Volume (24h)", true)}
                    <th className="num">Supply</th>
                    <th className="num">Last 7 days</th>
                    <th className="num">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((c) => (
                    <tr key={c.id}>
                      <td className="tnum" style={{ color: "var(--muted)" }}>{c.market_cap_rank}</td>
                      <td>
                        <Link to={`/coin/${c.id}`} className="coin-id">
                          <img src={c.image} alt="" loading="lazy" />
                          <span><b>{c.name}</b><small>{c.symbol}</small></span>
                        </Link>
                      </td>
                      <td className="num tnum"><b>{fmtMoney(c.current_price, fiat)}</b></td>
                      <td className="num">{pct(c.price_change_percentage_1h_in_currency)}</td>
                      <td className="num">{pct(c.price_change_percentage_24h)}</td>
                      <td className="num">{pct(c.price_change_percentage_7d_in_currency)}</td>
                      <td className="num tnum">{fmtMoney(c.market_cap, fiat, true)}</td>
                      <td className="num tnum">{fmtMoney(c.total_volume, fiat, true)}</td>
                      <td className="num tnum" style={{ color: "var(--muted)" }}>{c.circulating_supply ? c.circulating_supply.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"} {c.symbol.toUpperCase()}</td>
                      <td className="num"><Sparkline data={c.sparkline_in_7d?.price} up={(c.price_change_percentage_7d_in_currency ?? 0) >= 0} /></td>
                      <td className="num"><Link className="more" style={{ margin: 0 }} to={`/trade?coin=${c.id}`}>Trade →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          )}

          {rows && rows.length === 0 && <div className="empty-state">No coins match “{q}”.</div>}

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 26 }}>
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-ghost" disabled={pages <= 1} style={{ opacity: pages <= 1 ? 0.4 : 1 }} onClick={() => setPages(1)}>Top 100</motion.button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-ghost" disabled={pages >= 2} style={{ opacity: pages >= 2 ? 0.4 : 1 }} onClick={() => setPages(2)}>Load top 200</motion.button>
          </div>
          <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, marginTop: 20 }}>
            Data: CoinGecko public API (free tier). Prices may be delayed; refreshes automatically every 60 seconds.
          </p>
        </div>
      </Section>
    </>
  );
}
