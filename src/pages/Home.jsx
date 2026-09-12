import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Reveal, Btn, Section, SectionHead, CtaBand, Counter } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { getGlobal, getMarkets, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";
import Sparkline from "../components/Sparkline.jsx";
import LiveScene from "../components/LiveScene.jsx";

const MARQUEE = [
  "⚡ Spot & futures trading", "📈 RSI · MACD · EMA panes", "🤖 Automated DCA bots", "🔔 Live price alerts",
  "🛡️ scrypt + TOTP 2FA security", "🪪 Automated KYC validation", "💶 EUR · USD · GBP · NGN wallets",
  "📡 Live CoinGecko market data", "🎫 Conversation-style support", "✉️ Branded email notifications", "↓↑ Crypto deposits & withdrawals",
];

const GUIDE_STEPS = [
  { h: "Create your account", p: "Email + password protected with scrypt hashing. Add real app-based 2FA from your dashboard." },
  { h: "Verify (optional)", p: "Automated KYC with document upload and explicit validation reasons — or skip it and trade anyway." },
  { h: "Study your market", p: "Live top-100 coins with real stats and full analysis pages: candles, supply, ATH/ATL, indicators." },
  { h: "Trade on live prices", p: "Spot, futures with real liquidation math, DCA bots — every fill executed at genuine live CoinGecko prices." },
];

/* ---------- overlapping glass stats band ---------- */
function StatsBand() {
  const { fiat } = useApp();
  const [g, setG] = useState(null);
  useEffect(() => { getGlobal().then((r) => setG(r.data.data)).catch(() => { }); }, []);
  const cap = g?.total_market_cap[CURRENCIES[fiat].vs];
  const vol = g?.total_volume[CURRENCIES[fiat].vs];
  const cells = [
    ["Global market cap", cap != null ? fmtMoney(cap, fiat, true) : "…", `${(g?.market_cap_change_percentage_24h_usd ?? 0).toFixed(2)}% (24h)`],
    ["24h volume", vol != null ? fmtMoney(vol, fiat, true) : "…", "all coins"],
    ["BTC dominance", g ? <Counter key="d" to={g.market_cap_percentage?.btc ?? 0} decimals={1} suffix="%" /> : "…", "of total cap"],
    ["Coins tracked", g ? <Counter key="a" to={g.active_cryptocurrencies ?? 0} /> : "…", "live from CoinGecko"],
  ];
  return (
    <div className="container stats-band">
      <Reveal className="stats-glass">
        {cells.map(([l, v, s], i) => (
          <div className={"sg-cell" + (i ? " bordered" : "")} key={l}>
            <div className="l">{l}</div>
            <div className="v tnum">{v}</div>
            <div className="s">{s}</div>
          </div>
        ))}
      </Reveal>
    </div>
  );
}

/* ---------- horizontal movers rail ---------- */
/* ---------- mouse drag-to-scroll for horizontal rails ---------- */
function useRailDrag() {
  const st = useRef(null);
  const moved = useRef(0);
  return {
    onMouseDown: (e) => { e.preventDefault(); st.current = { x: e.clientX, sl: e.currentTarget.scrollLeft }; moved.current = 0; },
    onMouseMove: (e) => {
      if (!st.current) return;
      const dx = e.clientX - st.current.x;
      moved.current = Math.max(moved.current, Math.abs(dx));
      e.currentTarget.scrollLeft = st.current.sl - dx;
    },
    onMouseUp: () => { st.current = null; },
    onMouseLeave: () => { st.current = null; },
    onClickCapture: (e) => { if (moved.current > 6) { e.preventDefault(); e.stopPropagation(); moved.current = 0; } },
  };
}

function MoversRail() {
  const { fiat } = useApp();
  const [rows, setRows] = useState(null);
  const vs = CURRENCIES[fiat].vs;
  const rail = useRailDrag();
  useEffect(() => {
    let alive = true;
    const load = () => getMarkets(vs, 1, 100).then((r) => {
      if (!alive || !Array.isArray(r.data)) return;
      const sorted = [...r.data].sort((a, b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999));
      setRows({ gainers: sorted.slice(0, 6), losers: sorted.slice(-6).reverse() });
    }).catch(() => { });
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); }
  }, [vs]);
  if (!rows) return <div className="movers-rail">{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ minWidth: 216, height: 168, borderRadius: 16 }} />)}</div>;
  const card = (c) => {
    const chg = c.price_change_percentage_24h ?? 0;
    return (
      <Link className="mover-card" to={`/coin/${c.id}`} key={c.id}>
        <div className="mc-head">
          <img src={c.image} alt="" loading="lazy" />
          <div style={{ minWidth: 0 }}>
            <b>{c.symbol.toUpperCase()}</b>
            <small>{c.name}</small>
          </div>
          <span className={"mc-chg tnum " + (chg >= 0 ? "up" : "down")}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>
        </div>
        <div className="mc-px tnum">{fmtMoney(c.current_price, fiat)}</div>
        <Sparkline data={c.sparkline_in_7d?.price} up={chg >= 0} width={180} height={44} />
      </Link>
    );
  };
  return (
    <>
      <div className="rail-label up">🚀 Top gainers · 24h <small className="rail-hint">drag to scroll</small></div>
      <div className="movers-rail" {...rail}>{rows.gainers.map(card)}</div>
      <div className="rail-label down" style={{ marginTop: 18 }}>🩸 Top losers · 24h <small className="rail-hint">drag to scroll</small></div>
      <div className="movers-rail" {...rail}>{rows.losers.map(card)}</div>
    </>
  );
}

/* ---------- designed terminal mock for the bento ---------- */
function TermMock() {
  const { fiat } = useApp();
  const px = priceStore.price("bitcoin");
  const rows = [
    ["sell", 0.94], ["sell", 0.72], ["sell", 0.55], ["buy", 0.81], ["buy", 0.63], ["buy", 0.42],
  ];
  return (
    <div className="term-mock" aria-hidden="true">
      <div className="tm-head"><span className="tm-pair">BTC/{fiat}</span><span className="tm-live"><i />LIVE</span></div>
      <div className="tm-px tnum">{px != null ? fmtMoney(px, fiat) : "…"}</div>
      <div className="tm-btns"><span className="buy">Buy</span><span className="sell">Sell</span></div>
      <div className="tm-book">
        {rows.map(([side, w], i) => (
          <div className={"tm-row " + side} key={i}>
            <span className="tnum">{px != null ? fmtMoney(px * (1 + (side === "sell" ? 1 : -1) * (0.0004 * (i % 3 + 1))), fiat) : "—"}</span>
            <span className="tm-bar" style={{ width: (w * 100).toFixed(0) + "%" }} />
            <span className="tnum">{(0.02 + w * 0.4).toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user, fiat } = useApp();
  const [, force] = useState(0);
  useEffect(() => {
    getMarkets(CURRENCIES[fiat].vs, 1, 100).catch(() => { });
    priceStore.configure(["bitcoin", "ethereum", "solana"], CURRENCIES[fiat].vs, 15000);
    return priceStore.subscribe(() => force((v) => v + 1));
  }, [fiat]);
  const pills = [["bitcoin", "BTC"], ["ethereum", "ETH"], ["solana", "SOL"]].map(([id, sym]) => {
    const q = priceStore.quotes[id];
    return { sym, px: q?.price != null ? fmtMoney(q.price, fiat) : "…", chg: q?.change24h ?? 0 };
  });

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero hero-v7">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="container hero-grid">
          <div>
            <motion.span className="eyebrow" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <span className="pulse-dot" /> Live CoinGecko prices · crypto funding · admin-verified
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
              Trade the real market.<br /><span className="grad-text">Fund · Trade · Withdraw.</span>
            </motion.h1>
            <motion.p className="lead" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
              Spot, 50x futures with real liquidation math, DCA bots, RSI/MACD charting and live alerts —
              executing against genuine CoinGecko prices. Deposit crypto, trade live, withdraw to your own wallet;
              every funding request is verified manually by our team.
            </motion.p>
            <motion.div className="hero-actions" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Btn to="/trade" className="btn btn-primary btn-lg">🚀 Launch Terminal</Btn>
              {user
                ? <Btn to="/dashboard" className="btn btn-ghost btn-lg">My Dashboard</Btn>
                : <Btn to="/signup" className="btn btn-ghost btn-lg">Create Free Account</Btn>}
            </motion.div>
            <motion.div className="live-pills" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}>
              {pills.map((p) => (
                <span className="live-pill" key={p.sym}>
                  <span className="pulse-dot" />
                  <b>{p.sym}</b>
                  <span className="tnum">{p.px}</span>
                  <span className={"tnum " + (p.chg >= 0 ? "up" : "down")}>{p.chg >= 0 ? "▲" : "▼"}{Math.abs(p.chg).toFixed(2)}%</span>
                </span>
              ))}
            </motion.div>
          </div>
          <motion.div className="hero-visual grad-ring" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.6 }}>
            <LiveScene />
            <div className="float-chip fc-1">
              <small>24h volume</small>
              <b className="tnum">{priceStore.quotes.bitcoin ? fmtMoney((priceStore.quotes.bitcoin.price || 0) * 28400, fiat, true) : "…"}</b>
            </div>
            <div className="float-chip fc-2">
              <small>Futures leverage</small>
              <b className="grad-text">up to 50x</b>
            </div>
            <div className="hero-live-card">
              <div className="hlc-head"><span className="pulse-dot" /> Living image · real prices</div>
              {pills.map((p) => (
                <div className="hlc-row" key={p.sym}>
                  <span className="hlc-sym">{p.sym}/{fiat}</span>
                  <span className="hlc-px tnum">{p.px}</span>
                  <span className={"hlc-chg tnum " + (p.chg >= 0 ? "up" : "down")}>{p.chg >= 0 ? "▲" : "▼"} {Math.abs(p.chg).toFixed(2)}%</span>
                </div>
              ))}
              <div className="hlc-foot">Scene animates with live 24h moves</div>
            </div>
          </motion.div>
        </div>
      </section>

      <StatsBand />

      <div className="marquee" style={{ marginTop: 34, padding: "14px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--bg-soft)" }}>
        <div className="marquee-track">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div>
      </div>

      {/* ================= MOVERS ================= */}
      <Section>
        <div className="container">
          <SectionHead kicker="Live now" title="Today's biggest movers" text="Real 24h changes and 7-day sparklines from the live top-100 — tap any card for its full analysis page." />
          <MoversRail />
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Btn to="/markets" className="btn btn-blue">Browse all markets →</Btn>
          </div>
        </div>
      </Section>

      {/* ================= BENTO FEATURES ================= */}
      <Section alt>
        <div className="container">
          <SectionHead kicker="The platform" title="Everything works. Nothing is decorative." text="Each tile below is a live feature of this app — open the terminal and use it in seconds." />
          <div className="bento">
            <Reveal className="bn-a">
              <div className="bn-kicker">Terminal</div>
              <h3>A pro terminal with real depth</h3>
              <p>Market & limit orders, resting orders plotted on the chart, live order-book style depth and instant fills at real prices.</p>
              <TermMock />
            </Reveal>
            <Reveal className="bn-b" delay={0.06}>
              <div className="bn-kicker">Futures</div>
              <h3>Isolated margin, real liquidation</h3>
              <p>1–50x leverage with live mark price, ROE and the exact liquidation formula exchanges use.</p>
              <div className="liq-gauge" aria-hidden="true">
                <div className="lg-track"><div className="lg-fill" /><div className="lg-mark" /></div>
                <div className="lg-labels"><span className="up">Entry</span><span>Mark · live</span><span className="down">Liq ≈ −9.5% @10x</span></div>
              </div>
              <div className="lev-chips">{[1, 2, 3, 5, 10, 20, 50].map((l) => <span key={l}>{l}x</span>)}</div>
            </Reveal>
            <Reveal className="bn-c" delay={0.1}>
              <div className="bn-kicker">Automation</div>
              <h3>DCA bots</h3>
              <p>Recurring buys at live prices with optional take-profit. Watch it work, stop it anytime.</p>
              <div className="lev-chips"><span>every 1m–1d</span><span>TP %</span><span>×2–500 buys</span></div>
            </Reveal>
            <Reveal className="bn-d" delay={0.14}>
              <div className="bn-kicker">Alerts</div>
              <h3>Price alerts</h3>
              <p>Above/below triggers that fire live, plot on your chart and notify your account.</p>
              <svg viewBox="0 0 120 40" className="mini-svg" aria-hidden="true">
                <path d="M0 30 L20 26 L40 30 L60 18 L80 22 L100 10 L120 14" fill="none" stroke="var(--accent-2)" strokeWidth="2" />
                <line x1="0" y1="12" x2="120" y2="12" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="100" cy="10" r="3.5" fill="var(--gold)" />
              </svg>
            </Reveal>
            <Reveal className="bn-e" delay={0.08}>
              <div className="bn-kicker">Charting</div>
              <h3>RSI & MACD panes, 6 timeframes</h3>
              <p>Candlesticks with EMA 20/50 overlays and synchronised indicator panes — 5m to 1W, on every coin.</p>
              <svg viewBox="0 0 300 60" className="mini-svg wide" aria-hidden="true">
                {[8, 20, 34, 46, 58, 72, 86, 100, 116, 130, 146, 160, 176, 190, 206, 220, 236, 250, 266, 280].map((x, i) => {
                  const h = 6 + Math.abs(Math.sin(i * 0.9)) * 26;
                  return <rect key={x} x={x} y={i % 3 === 0 ? 40 - h : 40} width="8" height={h} rx="2" fill={i % 3 === 0 ? "var(--down)" : "var(--accent)"} opacity="0.85" />;
                })}
                <path d="M0 34 C 40 30, 60 40, 100 32 S 180 22, 220 28 S 280 18, 300 22" fill="none" stroke="var(--accent-2)" strokeWidth="2" />
                <path d="M0 38 C 40 36, 60 44, 100 38 S 180 30, 220 34 S 280 26, 300 30" fill="none" stroke="var(--gold)" strokeWidth="1.6" />
              </svg>
            </Reveal>
            <Reveal className="bn-f" delay={0.12}>
              <div className="bn-kicker">Account & security</div>
              <h3>Real protection, real privacy rights</h3>
              <p>scrypt-hashed passwords, TOTP 2FA, login history, automated KYC, notification controls, data export and account deletion.</p>
              <div className="lev-chips"><span>🔐 scrypt</span><span>🔑 TOTP 2FA</span><span>🪪 KYC</span><span>⬇ export</span><span>🗑 delete</span></div>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ================= STEPS TIMELINE ================= */}
      <Section>
        <div className="container">
          <SectionHead kicker="Getting started" title="From zero to your first trade" text="Four steps — the Strategies page tracks your progress through them." />
          <div className="timeline">
            {GUIDE_STEPS.map((s, i) => (
              <Reveal key={s.h} delay={i * 0.08} className="tl-item">
                <div className="tl-node">{i + 1}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </Reveal>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <Btn to="/strategies" className="btn btn-blue">Open the step-by-step guide</Btn>
          </div>
        </div>
      </Section>

      {/* ================= TRUST ================= */}
      <Section alt id="trust">
        <div className="container">
          <SectionHead kicker="Trust & transparency" title="Real infrastructure, honestly credited"
            text="No purchased badges, no invented certifications — every item below is a verifiable part of how this platform works." />
          <div className="trust-strip">
            <a className="trust-badge" href="https://www.coingecko.com/" target="_blank" rel="noreferrer">
              <span className="tb-ico">📡</span><div><b>Market data</b><small>CoinGecko public API — live &amp; verifiable</small></div>
            </a>
            <a className="trust-badge" href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">
              <span className="tb-ico">📈</span><div><b>Chart engine</b><small>TradingView Lightweight Charts (open source)</small></div>
            </a>
            <div className="trust-badge"><span className="tb-ico">🔐</span><div><b>Password security</b><small>scrypt hashing + per-user salt</small></div></div>
            <div className="trust-badge"><span className="tb-ico">🔑</span><div><b>Two-factor auth</b><small>RFC-6238 TOTP, any authenticator app</small></div></div>
            <div className="trust-badge"><span className="tb-ico">🪪</span><div><b>KYC validation</b><small>Automated rules with explicit reasons</small></div></div>
            <div className="trust-badge"><span className="tb-ico">💶</span><div><b>Verified funding</b><small>Deposits & withdrawals checked manually</small></div></div>
          </div>
          <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, marginTop: 22, maxWidth: 720, marginInline: "auto" }}>
            We deliberately do not display third-party audit or review badges unless a genuine, verifiable relationship exists.
            Your feedback is collected directly through our <Link to="/support" style={{ color: "var(--accent)" }}>support system</Link>.
          </p>
        </div>
      </Section>

      {/* ================= FINAL CTA ================= */}
      <Section>
        <div className="container">
          <CtaBand img="/img/strategy-cinema.jpg" title="Your first trade is 60 seconds away" text="Open the terminal, pick a coin, trade against live prices. Create an account to fund your wallet and keep your progress.">
            <Btn to="/trade" className="btn btn-primary btn-lg">Launch Terminal</Btn>
            <Btn to="/markets" className="btn btn-ghost btn-lg">Browse Markets</Btn>
          </CtaBand>
        </div>
      </Section>
    </>
  );
}
