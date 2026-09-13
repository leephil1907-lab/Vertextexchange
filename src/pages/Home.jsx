import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Reveal, Btn, Section, SectionHead, Counter } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { getGlobal, getMarkets, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";
import Sparkline from "../components/Sparkline.jsx";
import LiveScene from "../components/LiveScene.jsx";

const MARQUEE = [
  "⚡ Spot & futures trading", "📈 RSI · MACD · EMA panes", "🤖 Automated DCA bots", "🔔 Live price alerts",
  "🛡️ scrypt + TOTP 2FA security", "🪪 Automated KYC validation", "💶 EUR · USD · GBP · NGN display",
  "📡 Live CoinGecko market data", "🎫 Conversation-style support", "✉️ Branded email notifications", "↓↑ Crypto deposits & withdrawals",
];

const GUIDE_STEPS = [
  { h: "Create your account", p: "Email + password protected with scrypt hashing. Add real app-based 2FA from your dashboard." },
  { h: "Verify (optional)", p: "Automated KYC with document upload and explicit validation reasons — or skip it and trade anyway." },
  { h: "Study your market", p: "Live top-100 coins with real stats and full analysis pages: candles, supply, ATH/ATL, indicators." },
  { h: "Trade on live prices", p: "Spot, futures with real liquidation math, DCA bots — every fill executed at genuine live CoinGecko prices." },
];

const FEATURES = [
  { icon: "📡", t: "Live market data", d: "Top-100 coins from CoinGecko's public API — real prices, 24h stats and 7-day sparklines in EUR, USD, GBP or NGN, refreshed continuously." },
  { icon: "⚡", t: "Spot & 50x futures", d: "Market and limit orders with instant fills, isolated margin with real liquidation math, DCA bots and alerts that fire on live prices." },
  { icon: "🛡️", t: "Security that's on", d: "scrypt-hashed passwords, TOTP two-factor auth, automated KYC validation, login history — plus data export and account deletion." },
  { icon: "💶", t: "Crypto funding, human checks", d: "Deposit and withdraw across 8 crypto rails. Every request is verified manually by our team before funds move — no blind auto-credits." },
];

const RAILS = [
  ["BTC", "Bitcoin", "#f7931a"], ["ETH", "Ethereum", "#627eea"],
  ["USDT", "Tether · ERC-20", "#26a17b"], ["USDT", "Tether · TRC-20", "#c23a4b"],
  ["SOL", "Solana", "#9945ff"], ["TRX", "TRON", "#d63a40"],
  ["XRP", "XRP", "#3b4a5a"], ["BNB", "BNB", "#c99a10"],
];

const SEC_ITEMS = [
  ["scrypt-hashed passwords", "Per-user salt — never stored in plain text"],
  ["TOTP two-factor auth", "RFC-6238, works with any authenticator app"],
  ["Automated KYC", "Document upload with explicit validation reasons"],
  ["Login history", "Every session recorded on your account"],
  ["Your data, your call", "One-click export and account deletion"],
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

/* ---------- live top-markets snapshot (real CoinGecko data, terminal-styled) ---------- */
function LiveSnap({ compact = false }) {
  const { fiat } = useApp();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => getMarkets(CURRENCIES[fiat].vs, 1, 100).then((r) => {
      if (!alive || !Array.isArray(r.data)) return;
      setRows(r.data.slice(0, compact ? 5 : 6));
    }).catch(() => { });
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); }
  }, [fiat, compact]);
  return (
    <div className="snap-panel" aria-label={"Live top markets in " + fiat}>
      <div className="tm-head"><span className="tm-pair">Top markets</span><span className="tm-live"><i />LIVE · {fiat.toUpperCase()}</span></div>
      {!rows && [...Array(compact ? 5 : 6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 34, borderRadius: 8, marginBottom: 6 }} />)}
      {rows?.map((c) => {
        const chg = c.price_change_percentage_24h ?? 0;
        return (
          <div className="snap-row" key={c.id}>
            <img src={c.image} alt="" loading="lazy" />
            <div className="snap-id"><b>{c.symbol.toUpperCase()}</b><small>{c.name}</small></div>
            <Sparkline data={c.sparkline_in_7d?.price} up={chg >= 0} width={64} height={26} />
            <div className="snap-px">
              <b className="tnum">{fmtMoney(c.current_price, fiat)}</b>
              <small className={"tnum " + (chg >= 0 ? "up" : "down")}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= animated hero carousel ================= */
const EASE = [0.21, 0.65, 0.36, 1];

/* cursor-tracking spotlight — CSS vars only, no re-renders (60fps) */
function spot(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
  el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
}
const slideV = (reduced) => ({
  enter: (d) => ({ opacity: 0, x: reduced ? 0 : d * 72 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE, staggerChildren: 0.07, delayChildren: 0.12 } },
  exit: (d) => ({ opacity: 0, x: reduced ? 0 : -d * 72, transition: { duration: 0.32, ease: "easeIn" } }),
});
const itemV = (reduced) => ({
  enter: { opacity: 0, y: reduced ? 0 : 26 },
  center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0 },
});

function HeroCarousel({ user, fiat, pills }) {
  const reduced = useReducedMotion();
  const [[idx, dir], setNav] = useState([0, 1]);
  const [paused, setPaused] = useState(false);
  const tx = useRef(null);
  const N = 4;

  const go = useCallback((d) => setNav(([i]) => [(i + d + N) % N, d]), []);
  const goTo = useCallback((j) => setNav(([i]) => [j, j > i ? 1 : -1]), []);

  useEffect(() => {
    if (paused || reduced) return undefined;
    const t = setInterval(() => go(1), 6000);
    return () => clearInterval(t);
  }, [idx, paused, reduced, go]);

  const onTouchStart = (e) => { tx.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (tx.current == null) return;
    const dx = e.changedTouches[0].clientX - tx.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    tx.current = null;
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };

  const sv = slideV(reduced);
  const iv = itemV(reduced);

  const slides = [
    {
      key: "live",
      kicker: <><span className="pulse-dot" /> Live CoinGecko prices · crypto funding</>,
      h1: <>Trade the real market.<br /><span className="grad-text">Fund · Trade · Withdraw.</span></>,
      lead: "Spot, 50x futures with real liquidation math, DCA bots, RSI/MACD charting and live alerts — every fill executed at genuine live prices. Deposit crypto, trade, withdraw to your own wallet.",
      ctas: <>
        <Btn to="/trade" className="btn btn-primary btn-lg">🚀 Launch Terminal</Btn>
        {user
          ? <Btn to="/dashboard" className="btn btn-ghost btn-lg">My Dashboard</Btn>
          : <Btn to="/signup" className="btn btn-ghost btn-lg">Create Free Account</Btn>}
      </>,
      pills: true,
      visual: (
        <div className="hc-visual grad-ring">
          <LiveScene />
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
        </div>
      ),
    },
    {
      key: "terminal",
      kicker: <>🖥️ Pro terminal</>,
      h1: <>Everything a pro terminal needs.<br /><span className="grad-text">Nothing it doesn't.</span></>,
      lead: "Market & limit orders with instant fills, resting orders plotted on the chart, live depth, six timeframes with RSI, MACD and EMA overlays — plus price alerts that actually fire.",
      ctas: <>
        <Btn to="/trade" className="btn btn-primary btn-lg">Open the Terminal</Btn>
        <Btn to="/markets" className="btn btn-ghost btn-lg">Browse Markets</Btn>
      </>,
      visual: (
        <div className="hc-visual" style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", background: "var(--bg-elev)", padding: 16 }}>
          <LiveSnap />
        </div>
      ),
    },
    {
      key: "funding",
      kicker: <>↓↑ Crypto funding</>,
      h1: <>Deposit crypto.<br /><span className="grad-text">Verified by humans.</span></>,
      lead: "Eight crypto rails to fund your wallet. Every deposit and withdrawal is checked manually by our team before funds move — no blind auto-credits, no mystery holds.",
      ctas: <>
        {user
          ? <Btn to="/funding" className="btn btn-primary btn-lg">Go to Funding</Btn>
          : <Btn to="/signup" className="btn btn-primary btn-lg">Create Free Account</Btn>}
        <Btn to="/fees" className="btn btn-ghost btn-lg">See Fees</Btn>
      </>,
      visual: (
        <div>
          <div className="fund-grid">
            {RAILS.map(([sym, name, color], i) => (
              <motion.div className="fund-chip" key={sym + name} variants={iv} custom={i}>
                <span className="fc-badge" style={{ background: color }}>{sym.slice(0, 4)}</span>
                <span><b>{name}</b><small>{sym}</small></span>
              </motion.div>
            ))}
          </div>
          <div className="hc-note">🛡️ <span>Deposits &amp; withdrawals verified manually — balances update only after approval.</span></div>
        </div>
      ),
    },
    {
      key: "security",
      kicker: <>🔐 Security & account</>,
      h1: <>Security that's<br /><span className="grad-text">actually on.</span></>,
      lead: "Real protections you can inspect from your dashboard — not marketing stickers. Verify your identity, lock your account with 2FA, and keep full control of your data.",
      ctas: <>
        {user
          ? <Btn to="/dashboard?tab=security" className="btn btn-primary btn-lg">Security Settings</Btn>
          : <Btn to="/signup" className="btn btn-primary btn-lg">Create Free Account</Btn>}
        <Btn to="/learn" className="btn btn-ghost btn-lg">Learn the Basics</Btn>
      </>,
      visual: (
        <div className="sec-list">
          {SEC_ITEMS.map(([t, s], i) => (
            <motion.div className="sec-item" key={t} variants={iv} custom={i}>
              <i>✓</i>
              <span>{t}<small>{s}</small></span>
            </motion.div>
          ))}
        </div>
      ),
    },
  ];

  const s = slides[idx];
  return (
    <section
      className="hero hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Platform highlights"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="container">
        <div
          className={"hc-frame" + (paused ? " paused" : "")}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="hc-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <AnimatePresence initial={false} custom={dir}>
              <motion.div
                key={s.key}
                className={"hc-slide s" + (idx + 1)}
                custom={dir}
                variants={sv}
                initial="enter"
                animate="center"
                exit="exit"
                aria-hidden={undefined}
              >
                <div className="hc-copy">
                  <motion.span className="eyebrow" variants={iv}>{s.kicker}</motion.span>
                  <motion.h1 variants={iv}>{s.h1}</motion.h1>
                  <motion.p className="lead" variants={iv}>{s.lead}</motion.p>
                  <motion.div className="hero-actions" variants={iv}>{s.ctas}</motion.div>
                  {s.pills && (
                    <motion.div className="live-pills" variants={iv}>
                      {pills.map((p) => (
                        <span className="live-pill" key={p.sym}>
                          <span className="pulse-dot" />
                          <b>{p.sym}</b>
                          <span className="tnum">{p.px}</span>
                          <span className={"tnum " + (p.chg >= 0 ? "up" : "down")}>{p.chg >= 0 ? "▲" : "▼"}{Math.abs(p.chg).toFixed(2)}%</span>
                        </span>
                      ))}
                    </motion.div>
                  )}
                </div>
                <motion.div variants={iv} style={{ minWidth: 0, position: "relative" }}>{s.visual}</motion.div>
              </motion.div>
            </AnimatePresence>
            <button className="hc-arrow prev" aria-label="Previous slide" onClick={() => go(-1)}>‹</button>
            <button className="hc-arrow next" aria-label="Next slide" onClick={() => go(1)}>›</button>
          </div>
          <div className="hc-bar">
            <div className="hc-dots">
              {slides.map((sl, i) => (
                <button
                  key={sl.key}
                  className={"hc-dot" + (i === idx ? " active" : "")}
                  aria-label={"Go to slide " + (i + 1)}
                  onClick={() => goTo(i)}
                >
                  {i === idx && <i key={"p" + idx} />}
                </button>
              ))}
            </div>
            <span className="hc-count tnum">{String(idx + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user, fiat } = useApp();
  const reduced = useReducedMotion();
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
      {/* ================= HERO CAROUSEL ================= */}
      <HeroCarousel user={user} fiat={fiat} pills={pills} />

      <StatsBand />

      <div className="marquee" style={{ marginTop: 34, padding: "14px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--bg-soft)" }}>
        <div className="marquee-track">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div>
      </div>

      {/* ================= FEATURE HIGHLIGHTS ================= */}
      <Section>
        <div className="container">
          <SectionHead kicker="Why Vertex Trader" title="Built to be used, not just browsed"
            text="Four things this platform does for you from day one — every one of them is live right now." />
          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.t}
                className="card feat-card spot-card"
                onMouseMove={spot}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                whileHover={{ y: -6 }}
              >
                <div className="icon">{f.icon}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ================= MOVERS ================= */}
      <Section alt>
        <div className="container">
          <SectionHead kicker="Live now" title="Today's biggest movers" text="Real 24h changes and 7-day sparklines from the live top-100 — tap any card for its full analysis page." />
          <MoversRail />
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Btn to="/markets" className="btn btn-blue">Browse all markets →</Btn>
          </div>
        </div>
      </Section>

      {/* ================= BENTO FEATURES ================= */}
      <Section>
        <div className="container">
          <SectionHead kicker="The platform" title="Everything works. Nothing is decorative." text="Each tile below is a live feature of this app — open the terminal and use it in seconds." />
          <div className="bento">
            <Reveal className="bn-a spot-card" onMouseMove={spot}>
              <div className="bn-kicker">Terminal</div>
              <h3>A pro terminal with real depth</h3>
              <p>Market & limit orders, resting orders plotted on the chart, live order-book style depth and instant fills at real prices.</p>
              <LiveSnap compact />
            </Reveal>
            <Reveal className="bn-b spot-card" onMouseMove={spot} delay={0.06}>
              <div className="bn-kicker">Futures</div>
              <h3>Isolated margin, real liquidation</h3>
              <p>1–50x leverage with live mark price, ROE and the exact liquidation formula exchanges use.</p>
              <div className="liq-gauge" aria-hidden="true">
                <div className="lg-track"><div className="lg-fill" /><div className="lg-mark" /></div>
                <div className="lg-labels"><span className="up">Entry</span><span>Mark · live</span><span className="down">Liq ≈ −9.5% @10x</span></div>
              </div>
              <div className="lev-chips">{[1, 2, 3, 5, 10, 20, 50].map((l) => <span key={l}>{l}x</span>)}</div>
            </Reveal>
            <Reveal className="bn-c spot-card" onMouseMove={spot} delay={0.1}>
              <div className="bn-kicker">Automation</div>
              <h3>DCA bots</h3>
              <p>Recurring buys at live prices with optional take-profit. Watch it work, stop it anytime.</p>
              <div className="lev-chips"><span>every 1m–1d</span><span>TP %</span><span>×2–500 buys</span></div>
            </Reveal>
            <Reveal className="bn-d spot-card" onMouseMove={spot} delay={0.14}>
              <div className="bn-kicker">Alerts</div>
              <h3>Price alerts</h3>
              <p>Above/below triggers that fire live, plot on your chart and notify your account.</p>
              <svg viewBox="0 0 120 40" className="mini-svg" aria-hidden="true">
                <path d="M0 30 L20 26 L40 30 L60 18 L80 22 L100 10 L120 14" fill="none" stroke="var(--accent-2)" strokeWidth="2" />
                <line x1="0" y1="12" x2="120" y2="12" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="100" cy="10" r="3.5" fill="var(--gold)" />
              </svg>
            </Reveal>
            <Reveal className="bn-e spot-card" onMouseMove={spot} delay={0.08}>
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
            <Reveal className="bn-f spot-card" onMouseMove={spot} delay={0.12}>
              <div className="bn-kicker">Account & security</div>
              <h3>Real protection, real privacy rights</h3>
              <p>scrypt-hashed passwords, TOTP 2FA, login history, automated KYC, notification controls, data export and account deletion.</p>
              <div className="lev-chips"><span>🔐 scrypt</span><span>🔑 TOTP 2FA</span><span>🪪 KYC</span><span>⬇ export</span><span>🗑 delete</span></div>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ================= HOW IT WORKS ================= */}
      <Section alt>
        <div className="container">
          <SectionHead kicker="Getting started" title="From zero to your first trade" text="Four steps — the Strategies page tracks your progress through them." />
          <div className="timeline">
            {GUIDE_STEPS.map((st, i) => (
              <Reveal key={st.h} delay={i * 0.08} className="tl-item">
                <motion.div
                  className="tl-node-anim"
                  initial={{ scale: 0.4, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.1 + i * 0.09 }}
                >
                  <div className="tl-node">{i + 1}</div>
                </motion.div>
                <h3>{st.h}</h3>
                <p>{st.p}</p>
              </Reveal>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <Btn to="/strategies" className="btn btn-blue">Open the step-by-step guide</Btn>
          </div>
        </div>
      </Section>

      {/* ================= TRUST ================= */}
      <Section id="trust">
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

      {/* ================= ANIMATED SIGNUP CTA ================= */}
      <Section>
        <div className="container">
          <Reveal className="cta-anim">
            <motion.div className="cta-blob cb1" aria-hidden="true"
              animate={reduced ? undefined : { y: [0, -30, 0], scale: [1, 1.14, 1] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div className="cta-blob cb2" aria-hidden="true"
              animate={reduced ? undefined : { y: [0, 26, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: -3 }} />
            <motion.div className="cta-blob cb3" aria-hidden="true"
              animate={reduced ? undefined : { x: [0, -40, 0], y: [0, 18, 0] }}
              transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: -6 }} />
            <div className="cta-grid" aria-hidden="true" />
            <h2>Your first trade is 60 seconds away</h2>
            <p>Open the terminal and trade against live prices — or create a free account to fund your wallet with crypto and track everything from your dashboard.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <Btn to="/trade" className="btn btn-primary btn-lg">Launch Terminal</Btn>
              {user
                ? <Btn to="/dashboard" className="btn btn-cta-ghost btn-lg">My Dashboard</Btn>
                : <Btn to="/signup" className="btn btn-cta-ghost btn-lg">Create Free Account</Btn>}
            </div>
            <div className="cta-fine">Free account · No deposit needed to explore live markets{!user && <> · Already trading? <Link to="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>Log in</Link></>}</div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
