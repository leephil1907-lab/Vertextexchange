import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Reveal, Section, SectionHead, PageHero, CtaBand, Btn } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";

const GUIDE_KEY = "vt_guide_progress_v1";

const GUIDE = [
  {
    h: "Create your account",
    p: "Sign up with your email and a strong password. Your account stores your wallet, orders, bots and performance history. You can also explore the terminal first without an account — progress is kept on this device as a guest.",
    acts: [["Sign up free", "/signup"], ["Open terminal as guest", "/trade"]],
  },
  {
    h: "Lock down your security",
    p: "In Dashboard → Security, enable two-factor authentication. The setup shows a secret you add to any authenticator app (Google Authenticator, Authy, 1Password…); codes are verified server-side using the standard TOTP algorithm. You can also review login history and change your password there.",
    acts: [["Open Security", "/dashboard?tab=security"]],
  },
  {
    h: "Complete KYC verification",
    p: "Dashboard → KYC walks you through identity details and document upload. Validation is automated: fields are checked for completeness and format, age is verified from your date of birth, and uploads must be valid images. If something fails you get the exact reasons and can resubmit.",
    acts: [["Start verification", "/dashboard?tab=kyc"]],
  },
  {
    h: "Study a market before trading it",
    p: "Open Markets and pick a coin — each one has a full analysis page with real candlestick history, market cap, supply, all-time highs/lows and the project's own description. Toggle EMA, RSI and MACD to see trend, momentum and volatility at a glance.",
    acts: [["Browse live markets", "/markets"]],
  },
  {
    h: "Place your first spot trade",
    p: "In the terminal's Spot tab: choose Buy or Sell, Market (fills instantly at the live price) or Limit (rests until the live price crosses it). Use the % slider to size the order against your wallet. Watch the fee, total and fill price update before you commit — then track it in History.",
    acts: [["Go to Spot tab", "/trade?tab=spot"]],
  },
  {
    h: "Try futures with small leverage",
    p: "Futures adds margin and liquidation: pick 2x–3x to start, enter your margin, and read the estimated liquidation price before opening. Positions mark to the live price with ROE; if price hits your liquidation level the position closes and the margin is lost. That's the lesson real leverage teaches — learn it here for free.",
    acts: [["Go to Futures tab", "/trade?tab=futures"]],
  },
  {
    h: "Automate with a DCA bot",
    p: "DCA removes timing stress: set an amount, an interval and number of buys, optionally add a take-profit %. The bot executes at live prices on schedule, tracks your average entry, and you can stop it any time. It's the classic beginner strategy — now you've run one end-to-end.",
    acts: [["Configure a DCA bot", "/trade?tab=dca"]],
  },
];

const STRATEGIES = [
  {
    icon: "🤖", name: "Dollar-Cost Averaging (DCA)", level: "Beginner", badge: "badge-pop", automated: true,
    what: "Buy a fixed amount at regular intervals regardless of price, smoothing your average entry over time.",
    why: "Removes emotional timing decisions. Historically reduces the impact of buying a local top. Ideal for long-horizon conviction assets like BTC or ETH.",
    steps: ["Open the DCA tab in the terminal", "Set amount per buy (e.g. 50 EUR) and interval", "Choose total number of buys and optional take-profit %", "Start the bot and monitor average entry in the DCA panel"],
    deploy: { to: "/trade?tab=dca&coin=bitcoin", label: "Deploy DCA on BTC" },
  },
  {
    icon: "📈", name: "EMA Trend Following", level: "Intermediate", badge: "badge-new", automated: false,
    what: "Trade in the direction of the trend: go long when the fast EMA (20) crosses above the slow EMA (50), exit on the reverse cross.",
    why: "Captures sustained moves instead of predicting tops and bottoms. Loses small in choppy ranges, wins big in trends.",
    steps: ["Open a coin chart with EMA20 + EMA50 enabled", "Wait for a clean cross with volume confirming", "Enter in the cross direction with a stop beyond the recent swing", "Exit on the opposite cross or your stop"],
    deploy: { to: "/trade?coin=ethereum&ind=ema", label: "Open chart with EMAs" },
  },
  {
    icon: "🔄", name: "RSI Mean Reversion", level: "Intermediate", badge: "badge-new", automated: false,
    what: "Buy oversold conditions (RSI < 30) in ranging markets, sell overbought (RSI > 70), targeting reversion to the middle.",
    why: "Markets range more often than they trend. RSI quantifies stretched conditions so you fade extremes with discipline.",
    steps: ["Enable the RSI pane on a 1H or 4H chart", "Confirm the market is ranging (no strong EMA slope)", "Enter at RSI extremes with limit orders", "Take profit near RSI 50; stop if RSI stays pinned"],
    deploy: { to: "/trade?coin=solana&ind=rsi", label: "Open chart with RSI" },
  },
  {
    icon: "⚡", name: "MACD Momentum", level: "Advanced", badge: "badge-hot", automated: false,
    what: "Use MACD line/signal crosses and histogram expansion to time entries in the direction of building momentum.",
    why: "Combines trend and momentum: histogram shows acceleration, crosses give triggers. Works best after a consolidation breakout.",
    steps: ["Enable the MACD pane alongside EMAs", "Look for histogram flipping sign and expanding", "Enter on the MACD/signal cross in trend direction", "Trail your stop while histogram keeps expanding"],
    deploy: { to: "/trade?coin=bitcoin&ind=macd,ema", label: "Open chart with MACD" },
  },
  {
    icon: "🧱", name: "Range Breakout", level: "Advanced", badge: "badge-hot", automated: false,
    what: "Mark a consolidation range, set alerts above/below it, and trade the breakout with volume confirmation.",
    why: "Volatility compresses before expanding. Alerts let the market come to you instead of screen-watching.",
    steps: ["Identify a flat range on the 4H or 1D chart", "Set price alerts just outside both edges", "When an alert fires, check volume before entering", "Target range-height projection; stop back inside the range"],
    deploy: { to: "/trade?coin=ripple", label: "Set breakout alerts" },
  },
  {
    icon: "🛡️", name: "Core & Satellite", level: "Beginner", badge: "badge-pop", automated: false,
    what: "Keep 70–80% of a portfolio in a DCA'd core (BTC/ETH), and use a small satellite allocation for active strategy trades.",
    why: "Structural risk control: the core compounds passively while the satellite satisfies the urge to trade — with a hard cap on damage.",
    steps: ["Run a DCA bot on your core asset", "Use the Swap tab to carve out a fixed satellite amount", "Trade the satellite with any strategy above", "Rebalance when satellite grows beyond its cap"],
    deploy: { to: "/trade?tab=dca", label: "Start your core DCA" },
  },
];

export default function Strategies() {
  const { user } = useApp();
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GUIDE_KEY) || "[]"); } catch (e) { return []; }
  });
  useEffect(() => { localStorage.setItem(GUIDE_KEY, JSON.stringify(done)); }, [done]);
  const toggle = (i) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const progress = Math.round((done.length / GUIDE.length) * 100);

  return (
    <>
      <PageHero crumb="Strategies" title="Start here: your step-by-step guide" text="Seven steps from complete beginner to running automated strategies — each one links straight to the tool you'll use. Your progress is tracked on this device." />

      <Section>
        <div className="container" style={{ maxWidth: 900 }}>
          <Reveal style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--muted)", marginBottom: 8 }}>
              <span>Guide progress</span><b className="tnum">{progress}% · {done.length}/{GUIDE.length} steps</b>
            </div>
            <div style={{ height: 9, borderRadius: 6, background: "var(--bg-elev)", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: progress + "%" }} transition={{ type: "spring", stiffness: 120, damping: 20 }}
                style={{ height: "100%", borderRadius: 6, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
            </div>
          </Reveal>

          {GUIDE.map((g, i) => (
            <Reveal key={g.h} delay={0.03}>
              <div className="guide-step">
                <div>
                  <motion.button onClick={() => toggle(i)} className="guide-num" whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                    style={{ cursor: "pointer", border: "none", background: done.includes(i) ? "linear-gradient(135deg,#0ca678,#22c98d)" : undefined, position: "relative" }}>
                    {done.includes(i) ? "✓" : i + 1}
                  </motion.button>
                  <div style={{ fontSize: 11.5, color: "var(--faint)", textAlign: "center", marginTop: 6, width: 54 }}>{done.includes(i) ? "done" : "step " + (i + 1)}</div>
                </div>
                <div>
                  <h3 style={{ textDecoration: done.includes(i) ? "line-through" : "none", opacity: done.includes(i) ? 0.6 : 1 }}>{g.h}</h3>
                  <p>{g.p}</p>
                  <div className="acts">
                    {g.acts.map(([label, to]) => (
                      <Link key={label} className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 13.5 }} to={to}>{label} →</Link>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}

          {progress === 100 && (
            <Reveal className="auth-ok" style={{ marginTop: 24, textAlign: "center", fontSize: 15 }}>
              🎉 Guide complete — you've used every core feature. Now pick a strategy below and make it yours.
            </Reveal>
          )}
        </div>
      </Section>

      <Section alt>
        <div className="container">
          <SectionHead kicker="Strategy library" title="Six strategies, explained honestly"
            text="DCA is fully automated in the terminal. The others open the terminal pre-configured with the right indicators — you execute them manually, which is exactly how real discretionary trading works." />
          <div className="grid-3">
            {STRATEGIES.map((s, i) => (
              <Reveal key={s.name} delay={(i % 3) * 0.07} className="card strat-card">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="icon" style={{ marginBottom: 0 }}>{s.icon}</div>
                  <div><h3 style={{ marginBottom: 2 }}>{s.name}</h3><span className={"badge " + s.badge}>{s.level}</span>{s.automated && <span className="badge badge-pop" style={{ marginLeft: 6 }}>⚙ automated</span>}</div>
                </div>
                <p><b style={{ color: "var(--text)" }}>What: </b>{s.what}</p>
                <p><b style={{ color: "var(--text)" }}>Why it works: </b>{s.why}</p>
                <ol style={{ margin: "4px 0 0 18px", color: "var(--muted)", fontSize: 13.5 }}>
                  {s.steps.map((st) => <li key={st} style={{ marginBottom: 4 }}>{st}</li>)}
                </ol>
                <Link className="btn btn-blue" style={{ marginTop: "auto" }} to={s.deploy.to}>{s.deploy.label} →</Link>
              </Reveal>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, marginTop: 26 }}>
            Educational content only — not financial advice. Every strategy can lose money in real markets; that's precisely why the terminal includes a demo mode to practise in first.
          </p>
        </div>
      </Section>

      <Section>
        <div className="container">
          <CtaBand img="/img/strategy-cinema.jpg" title={user ? "Continue where you left off" : "Ready to begin?"} text="The terminal is live with real market data. Follow the guide, deploy a DCA bot, and watch your equity curve build in the dashboard.">
            <Btn to="/trade" className="btn btn-primary btn-lg">Launch Terminal</Btn>
            {!user && <Btn to="/signup" className="btn btn-ghost btn-lg">Create Free Account</Btn>}
          </CtaBand>
        </div>
      </Section>
    </>
  );
}
