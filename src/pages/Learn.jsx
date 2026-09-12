import { useState } from "react";
import { Reveal, Btn, Section, SectionHead, PageHero, Tabs, CtaBand } from "../components/ui.jsx";

const COURSES = {
  Beginner: [
    { meta: "6 lessons · ~2 hrs", h: "Trading Foundations", p: "What spot and futures trading are, how margin and leverage really work, reading a candlestick chart, and placing your first trade safely." },
    { meta: "5 lessons · ~1.5 hrs", h: "Understanding Crypto Markets", p: "What moves bitcoin and altcoins, market cycles, stablecoins, why volatility is both the opportunity and the risk, and how 24/7 trading changes your habits." },
    { meta: "4 lessons · ~1 hr", h: "Platform Walkthrough", p: "A guided tour of this terminal: charts, indicators, order types, the order book, DCA bots and the dashboard." },
  ],
  Intermediate: [
    { meta: "8 lessons · ~3 hrs", h: "Technical Analysis in Practice", p: "Support & resistance, trend structure, candlestick patterns, EMA trends, RSI and MACD — practised on live charts with real candles." },
    { meta: "6 lessons · ~2 hrs", h: "Risk Management Mastery", p: "Position sizing, R-multiples, drawdown budgets, correlation exposure and building a trading plan you'll actually follow." },
    { meta: "5 lessons · ~2 hrs", h: "Reading Market Data", p: "Market cap vs FDV, circulating supply, volume quality, dominance charts and sentiment — the stats on every coin page, explained." },
  ],
  Advanced: [
    { meta: "7 lessons · ~4 hrs", h: "Futures & Liquidation Mechanics", p: "Isolated margin, maintenance margin, funding concepts, liquidation math at every leverage level, and why 50x is a different sport than 3x." },
    { meta: "6 lessons · ~3 hrs", h: "Systematic & Automated Trading", p: "Turning a rule-based strategy into a DCA schedule or alert workflow; backtesting ideas against historical candles; avoiding overfitting." },
    { meta: "5 lessons · ~2.5 hrs", h: "Trading Psychology", p: "Managing tilt, revenge trading and overconfidence after wins; journaling frameworks; building process-based habits." },
  ],
};

const GLOSSARY = [
  ["Candlestick", "A price bar showing open, high, low and close for a period. Green means the close finished above the open."],
  ["Market cap", "Price × circulating supply — the market's total valuation of a coin, not the money 'in' it."],
  ["FDV", "Fully diluted valuation: price × maximum supply. Shows future inflation pressure when tokens unlock."],
  ["Spread", "The gap between the best buy and best sell price — an implicit cost of every trade."],
  ["Slippage", "The difference between the price you expected and the price you got in a fast-moving market."],
  ["Leverage", "Borrowed exposure multiplying both gains and losses. 10x means a 10% adverse move wipes the margin."],
  ["Margin", "The collateral locked behind a leveraged position. Isolated margin caps losses to that collateral."],
  ["Liquidation", "Automatic closure of a leveraged position when losses consume the margin. The margin is gone."],
  ["Mark price", "The reference price (here: the live market price) used to compute unrealised P&L and liquidations."],
  ["DCA", "Dollar-cost averaging: buying fixed amounts on a schedule to smooth your average entry price."],
  ["RSI", "Relative Strength Index: a 0–100 momentum gauge. Below 30 is oversold, above 70 overbought."],
  ["MACD", "Moving-average convergence/divergence: trend-momentum indicator using the gap between two EMAs and a signal line."],
  ["EMA", "Exponential moving average: a weighted average of price that reacts faster than a simple average."],
  ["Take-profit", "A pre-set exit that locks in gains automatically when price reaches your target."],
  ["Stop-loss", "A protective exit that caps your loss at a pre-set price level."],
  ["Drawdown", "Peak-to-trough decline of an equity curve — the true measure of how bumpy a strategy is."],
  ["ROE", "Return on equity for a futures position: unrealised P&L divided by the margin committed."],
  ["Demo mode", "A practice session inside the terminal with separate demo funds at the same live prices — switched via the LIVE/DEMO toggle."],
];

const TABS = Object.keys(COURSES).map((k) => ({ id: k, label: k }));

export default function Learn() {
  const [tab, setTab] = useState("Beginner");
  const [gq, setGq] = useState("");
  const glossary = GLOSSARY.filter(([t, d]) => !gq || t.toLowerCase().includes(gq.toLowerCase()) || d.toLowerCase().includes(gq.toLowerCase()));
  return (
    <>
      <PageHero img="/img/learn-cinema.jpg" crumb="Learn" title="Learn to trade, properly" text="Structured courses, a strategy library and a plain-language glossary — written for this platform, practised on live market data." />

      <Section>
        <div className="container">
          <Reveal><Tabs tabs={TABS} active={tab} onChange={setTab} /></Reveal>
          <div className="grid-3">
            {COURSES[tab].map((c, i) => (
              <Reveal key={c.h} delay={i * 0.07} className="card">
                <span className="badge badge-pop" style={{ marginBottom: 12 }}>{c.meta}</span>
                <h3>{c.h}</h3><p>{c.p}</p>
                <Btn to="/trade" className="btn btn-ghost" style={{ marginTop: 16, alignSelf: "flex-start" }}>Practise in terminal →</Btn>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section alt id="glossary">
        <div className="container">
          <SectionHead kicker="Glossary" title="Every term you'll meet, in plain English" text={`${GLOSSARY.length} core terms — search to filter.`} />
          <Reveal style={{ maxWidth: 420, margin: "0 auto 34px" }}>
            <input value={gq} onChange={(e) => setGq(e.target.value)} placeholder="Search glossary…"
              style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--line)", color: "var(--text)", padding: "12px 16px", borderRadius: 12, font: "500 14px var(--font)", outline: "none" }} />
          </Reveal>
          <div className="grid-3">
            {glossary.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 0.05} className="card"><h3>{t}</h3><p>{d}</p></Reveal>
            ))}
          </div>
          {!glossary.length && <div className="empty-state">No glossary terms match “{gq}”.</div>}
        </div>
      </Section>

      <Section>
        <div className="container">
          <CtaBand title="Theory only sticks with practice" text="Open the strategies guide, follow the seven steps, and apply every concept on live charts.">
            <Btn to="/strategies" className="btn btn-primary btn-lg">Open the guide</Btn>
            <Btn to="/learn" className="btn btn-ghost btn-lg" href="#glossary">Browse glossary</Btn>
          </CtaBand>
        </div>
      </Section>
    </>
  );
}
