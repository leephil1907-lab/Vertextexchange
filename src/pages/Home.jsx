import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { Reveal, Btn, SectionHead, Counter } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { getGlobal, getMarkets, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";
import Sparkline from "../components/Sparkline.jsx";
import MarketSphere from "../components/MarketSphere.jsx";
import CoinIcon from "../components/CoinIcon.jsx";
import HeroChart from "../components/HeroChart.jsx";

const HERO_TABS = [["bitcoin", "BTC"], ["ethereum", "ETH"], ["solana", "SOL"], ["ripple", "XRP"]];

const MARQUEE = [
  "⚡ Spot & futures trading", "📈 RSI · MACD · EMA panes", "🤖 Automated DCA bots", "🔔 Live price alerts",
  "🛡️ scrypt + TOTP 2FA security", "🪪 Automated KYC validation", "💶 EUR · USD · GBP · NGN display",
  "📡 Live CoinGecko market data", "🎫 Conversation-style support", "✉️ Branded email notifications", "↓↑ Crypto deposits & withdrawals",
];

const SPHERE_IDS = ["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "tron", "binancecoin"];
const SYM = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", ripple: "XRP", cardano: "ADA", dogecoin: "DOGE", tron: "TRX", binancecoin: "BNB" };

const PLATES = [
  ["🔐", "scrypt-hashed passwords", "Per-user salt — never stored in plain text"],
  ["🔑", "TOTP two-factor auth", "RFC-6238 · works with any authenticator app"],
  ["🪪", "Automated KYC", "Document upload with explicit validation reasons"],
  ["🕘", "Login history", "Every session recorded on your account"],
  ["🗂️", "Your data, your call", "One-click export and permanent account deletion"],
];

const DA_CARDS = [
  ["💶", "Wallet & funding", "Deposits, withdrawals and verification status side by side.", [-150, 84, -5]],
  ["📊", "Positions", "Spot and futures with live ROE, margin and liquidation levels.", [150, 74, 5]],
  ["🤖", "DCA bots", "Recurring buys with take-profit — running while you sleep.", [-96, 118, 4]],
  ["🔔", "Alerts", "Above/below triggers that fire on live prices.", [116, 126, -4]],
  ["📈", "Performance", "Equity, history, best and worst trades at a glance.", [0, 150, 3]],
  ["🗝️", "Security", "2FA, sessions, KYC status, data export and deletion.", [70, 96, -3]],
];

/* ---------- media query hook ---------- */
function useMQ(query) {
  const [m, setM] = useState(() => (typeof matchMedia !== "undefined" ? matchMedia(query).matches : false));
  useEffect(() => {
    const mq = matchMedia(query);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [query]);
  return m;
}

/* ---------- overlapping glass stats band (real global data) ---------- */
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
    <div className="stats-band" style={{ marginTop: 8 }}>
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
  if (!rows) return <div className="movers-rail">{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ minWidth: 216, height: 168, borderRadius: 18 }} />)}</div>;
  const card = (c) => {
    const chg = c.price_change_percentage_24h ?? 0;
    return (
      <Link className="mover-card" to={`/coin/${c.id}`} key={c.id}>
        <div className="mc-head">
          <CoinIcon src={c.image} symbol={c.symbol} size={30} />
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

/* ---------- live top-markets snapshot (real data, terminal-styled) ---------- */
function LiveSnap({ count = 6, bare = false }) {
  const { fiat } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => getMarkets(CURRENCIES[fiat].vs, 1, 100).then((r) => {
      if (!alive || !Array.isArray(r.data)) return;
      setList(r.data.slice(0, count));
    }).catch(() => { });
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [fiat, count]);
  return (
    <div className="snap-panel" aria-label={"Live top markets in " + fiat}>
      {!bare && <div className="tm-head"><span className="tm-pair">Top markets</span><span className="tm-live"><i />LIVE · {fiat.toUpperCase()}</span></div>}
      {!list && [...Array(count)].map((_, i) => <div key={i} className="skeleton" style={{ height: 34, borderRadius: 8, marginBottom: 6 }} />)}
      {list?.map((c) => {
        const chg = c.price_change_percentage_24h ?? 0;
        return (
          <div className="snap-row" key={c.id}>
            <CoinIcon src={c.image} symbol={c.symbol} size={24} />
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

/* ---------- hero terminal: coin tabs + premium chart + live list ---------- */
function HeroTerminal({ fiat }) {
  const [tab, setTab] = useState("bitcoin");
  return (
    <>
      <div className="ht-head">
        <span className="ht-tabs" role="tablist" aria-label="Chart coin">
          {HERO_TABS.map(([id, sym]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              className={"ht-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
              {sym}
              {tab === id && <motion.i className="ht-tab-u" layoutId="ht-tab-u" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
            </button>
          ))}
        </span>
        <Link to="/trade">Open terminal →</Link>
      </div>
      <div className="ht-sub"><span className="tm-live"><i />LIVE · {fiat.toUpperCase()} · 7D hourly</span></div>
      <HeroChart coinId={tab} fiat={fiat} />
      <LiveSnap count={3} bare />
    </>
  );
}

/* ================= SCENE 01+02 — dark cinematic hero → terminal handoff ================= */
function HeroStory({ user, fiat, pills, quotes }) {
  const reduced = useReducedMotion();
  const desktop = useMQ("(min-width: 981px)");
  const cinematic = desktop && !reduced;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.4 });

  const sphereX = useTransform(p, [0, 1], cinematic ? ["0%", "-13%"] : ["0%", "0%"]);
  const sphereScale = useTransform(p, [0, 1], cinematic ? [1, 0.76] : [1, 1]);
  const copyY = useTransform(p, [0, 0.42], cinematic ? [0, -84] : [0, 0]);
  const copyO = useTransform(p, [0, 0.36], cinematic ? [1, 0] : [1, 1]);
  const termY = useTransform(p, [0.1, 0.55], cinematic ? [110, 0] : [0, 0]);
  const termO = useTransform(p, [0.1, 0.5], cinematic ? [0, 1] : [1, 1]);
  const cueO = useTransform(p, [0, 0.08], [1, 0]);

  return (
    <section className={"hero-story" + (cinematic ? " tall" : "")} ref={ref} aria-label="Vertex Trader — live market highlights">
      <div className="hero-sticky">
        <motion.div className="hero-sphere" style={{ x: sphereX, scale: sphereScale }}>
          <MarketSphere quotes={quotes} radius={desktop ? 0.3 : 0.34} particles={desktop ? 80 : 40} />
        </motion.div>
        <div className="hero-vignette" aria-hidden="true" />

        <div className="container hero-inner">
          <motion.div className="hero-copy" style={{ y: copyY, opacity: copyO }}>
            <motion.span className="eyebrow" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <span className="pulse-dot" /> Live CoinGecko prices · human-verified crypto funding
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
              Trade the<br /><span className="grad-text-hero">living market.</span>
            </motion.h1>
            <motion.p className="lead" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
              Spot, 50x futures with real liquidation math, DCA bots, RSI/MACD charting and alerts —
              every fill executed at genuine live prices. Fund with crypto, verified by humans.
            </motion.p>
            <motion.div className="hero-actions" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Btn to="/trade" className="btn btn-primary btn-lg">🚀 Launch Terminal</Btn>
              {user
                ? <Btn to="/dashboard" className="btn btn-hero-ghost btn-lg">My Dashboard</Btn>
                : <Btn to="/signup" className="btn btn-hero-ghost btn-lg">Create Free Account</Btn>}
            </motion.div>
            <motion.div className="live-pills" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}>
              {pills.map((pl) => (
                <span className="live-pill" key={pl.sym}>
                  <CoinIcon src={pl.img} symbol={pl.sym} size={16} />
                  <b>{pl.sym}</b>
                  <span className="tnum">{pl.px}</span>
                  <span className={"tnum " + (pl.chg >= 0 ? "up" : "down")}>{pl.chg >= 0 ? "▲" : "▼"}{Math.abs(pl.chg).toFixed(2)}%</span>
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>

        <motion.div className="hero-terminal motion-frame" style={{ y: termY, opacity: termO }}>
          <HeroTerminal fiat={fiat} />
        </motion.div>

        {cinematic && pills.map((pl, i) => (
          <motion.div
            key={pl.sym}
            className={"float-card motion-frame fc-" + (i + 1)}
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 6 + i * 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="fc-top"><CoinIcon src={pl.img} symbol={pl.sym} size={22} /><small>{pl.sym}/{fiat}</small></span>
            <b className="tnum">{pl.px}</b>
            <span className={"tnum " + (pl.chg >= 0 ? "up" : "down")}>{pl.chg >= 0 ? "▲" : "▼"} {Math.abs(pl.chg).toFixed(2)}%</span>
          </motion.div>
        ))}

        <motion.div className="scroll-cue" style={{ opacity: cueO }} aria-hidden="true">
          <span>Scroll — the market opens</span>
          <i>▾</i>
        </motion.div>
      </div>
    </section>
  );
}

/* ================= SCENE 03 — assets assemble ================= */
function AssetCard({ c, i, p, fiat }) {
  const reduced = useReducedMotion();
  const a = i * 0.035, b = 0.3 + i * 0.035;
  const y = useTransform(p, [a, b], reduced ? [0, 0] : [66, 0]);
  const o = useTransform(p, [a, b - 0.08], reduced ? [1, 1] : [0, 1]);
  const rot = useTransform(p, [a, b], reduced ? [0, 0] : [i % 2 ? 3.5 : -3.5, 0]);
  const chg = c.price_change_percentage_24h ?? 0;
  return (
    <motion.div style={{ y, opacity: o, rotate: rot }}>
      <Link className="asset-card motion-frame light" to={`/coin/${c.id}`}>
        <div className="ac-top">
          <span className="coin-3d"><CoinIcon src={c.image} symbol={c.symbol} size={34} /></span>
          <div style={{ minWidth: 0 }}>
            <b>{c.symbol.toUpperCase()}</b>
            <small>{c.name}</small>
          </div>
          <span className={"mc-chg tnum " + (chg >= 0 ? "up" : "down")}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>
        </div>
        <div className="ac-px tnum">{fmtMoney(c.current_price, fiat)}</div>
        <Sparkline data={c.sparkline_in_7d?.price} up={chg >= 0} width={190} height={42} />
      </Link>
    </motion.div>
  );
}

function AssetsScene({ fiat }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "end 55%"] });
  const [coins, setCoins] = useState(null);
  const vs = CURRENCIES[fiat].vs;
  useEffect(() => {
    let alive = true;
    getMarkets(vs, 1, 100).then((r) => { if (alive && Array.isArray(r.data)) setCoins(r.data.slice(0, 8)); }).catch(() => { });
    return () => { alive = false; };
  }, [vs]);
  return (
    <section className="scene" ref={ref} id="assets">
      <div className="container">
        <SectionHead kicker="Live assets" title="The market, assembled in real time"
          text="Real prices, real 24h moves, real 7-day sparklines from the live top-100 — tap any asset for its full analysis page." />
        <StatsBand />
        <div className="assets-grid">
          {coins
            ? coins.map((c, i) => <AssetCard key={c.id} c={c} i={i} p={scrollYProgress} fiat={fiat} />)
            : [...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 158, borderRadius: 18 }} />)}
        </div>
        <MoversRail />
        <div style={{ textAlign: "center", marginTop: 26 }}>
          <Btn to="/markets" className="btn btn-blue">Browse all markets →</Btn>
        </div>
      </div>
    </section>
  );
}

/* ================= SCENE 04 — security layers ================= */
function SecPlate({ pl, i, p }) {
  const reduced = useReducedMotion();
  const rx = useTransform(p, [0, 0.6], reduced ? [0, 0] : [62, 0]);
  const y = useTransform(p, [0, 0.6], [(i - 2) * (reduced ? 15 : 56), (i - 2) * 15]);
  const o = useTransform(p, [i * 0.05, 0.2 + i * 0.05], reduced ? [1, 1] : [0, 1]);
  return (
    <motion.div className="sec-plate motion-frame light" style={{ rotateX: rx, y, opacity: o, zIndex: 10 - i }}>
      <span className="sp-ico">{pl[0]}</span>
      <div><b>{pl[1]}</b><small>{pl[2]}</small></div>
    </motion.div>
  );
}

function SecurityScene() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "end 62%"] });
  return (
    <section className="scene scene-alt" ref={ref} id="security">
      <div className="container">
        <SectionHead kicker="Security" title="Protection, layer by layer"
          text="Five real systems stand between the market and your account — watch them assemble." />
        <div className="sec-stage">
          {PLATES.map((pl, i) => <SecPlate key={pl[1]} pl={pl} i={i} p={scrollYProgress} />)}
        </div>
        <div id="trust">
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
      </div>
    </section>
  );
}

/* ================= SCENE 05 — platform assembles ================= */
function DashCard({ c, i, p }) {
  const reduced = useReducedMotion();
  const a = i * 0.045, b = 0.42 + i * 0.045;
  const x = useTransform(p, [a, b], reduced ? [0, 0] : [c[3][0], 0]);
  const y = useTransform(p, [a, b], reduced ? [0, 0] : [c[3][1], 0]);
  const rot = useTransform(p, [a, b], reduced ? [0, 0] : [c[3][2], 0]);
  const o = useTransform(p, [a, b - 0.1], reduced ? [1, 1] : [0, 1]);
  return (
    <motion.div className="da-card" style={{ x, y, rotate: rot, opacity: o }}>
      <b>{c[0]} {c[1]}</b>
      <small>{c[2]}</small>
      <div className="skeleton skel-bar" style={{ width: "92%" }} />
      <div className="skeleton skel-bar" style={{ width: "68%" }} />
      <div className="skeleton skel-bar" style={{ width: "45%", marginBottom: 0 }} />
    </motion.div>
  );
}

function PlatformScene({ user }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 90%", "end 58%"] });
  return (
    <section className="scene" ref={ref} id="platform">
      <div className="container">
        <SectionHead kicker="Platform" title="Your dashboard assembles itself"
          text="Wallet, positions, bots, alerts, performance and security — one cockpit around your data." />
        <div className="dash-assembly">
          {DA_CARDS.map((c, i) => <DashCard key={c[1]} c={c} i={i} p={scrollYProgress} />)}
        </div>
        <div style={{ textAlign: "center", marginTop: 30 }}>
          {user
            ? <Btn to="/dashboard" className="btn btn-primary btn-lg">Open my dashboard</Btn>
            : <Btn to="/signup" className="btn btn-primary btn-lg">Create free account</Btn>}
        </div>
      </div>
    </section>
  );
}

/* ================= SCENE 06 — everything simplifies ================= */
function CtaScene({ user, quotes }) {
  return (
    <section className="cta-story">
      <MarketSphere quotes={quotes.slice(0, 5)} radius={0.36} particles={34} scrollTilt={false} className="cta-sphere" />
      <div className="container cta-story-inner">
        <Reveal>
          <h2>Trade the market.</h2>
          <p>Funding verified by humans. Every order executed against live prices. Nothing decorative, nothing faked.</p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <Btn to="/trade" className="btn btn-primary btn-lg">Launch Terminal</Btn>
            {user
              ? <Btn to="/dashboard" className="btn btn-hero-ghost btn-lg">My Dashboard</Btn>
              : <Btn to="/signup" className="btn btn-hero-ghost btn-lg">Create Free Account</Btn>}
          </div>
          <div className="cta-fine" style={{ color: "rgba(238,243,251,.62)" }}>
            Free account · No deposit needed to explore live markets
            {!user && <> · Already trading? <Link to="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>Log in</Link></>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { user, fiat } = useApp();
  const [, force] = useState(0);
  const [logos, setLogos] = useState({});
  useEffect(() => {
    getMarkets(CURRENCIES[fiat].vs, 1, 100).then((r) => {
      if (!Array.isArray(r?.data)) return;
      const m = {};
      r.data.forEach((c) => { m[c.id] = c.image; });
      setLogos(m);
    }).catch(() => { });
    priceStore.configure(SPHERE_IDS, CURRENCIES[fiat].vs, 15000);
    return priceStore.subscribe(() => force((v) => v + 1));
  }, [fiat]);

  const quotes = SPHERE_IDS.map((id) => {
    const q = priceStore.quotes[id];
    return q ? { sym: SYM[id], chg: q.change24h ?? 0 } : null;
  }).filter(Boolean);

  const pills = [["bitcoin", "BTC"], ["ethereum", "ETH"], ["solana", "SOL"]].map(([id, sym]) => {
    const q = priceStore.quotes[id];
    return { sym, img: logos[id] || null, px: q?.price != null ? fmtMoney(q.price, fiat) : "…", chg: q?.change24h ?? 0 };
  });

  return (
    <>
      <HeroStory user={user} fiat={fiat} pills={pills} quotes={quotes} />

      <div className="strip-dark">
        <div className="marquee" style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
          <div className="marquee-track">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div>
        </div>
      </div>

      <AssetsScene fiat={fiat} />
      <SecurityScene />
      <PlatformScene user={user} />
      <CtaScene user={user} quotes={quotes} />
    </>
  );
}
