import { Reveal, Btn, Section, SectionHead, PageHero, CtaBand } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";

const VALUES = [
  { icon: "🎯", h: "Learn without burning capital", p: "Most new traders lose money in their first year — usually to leverage and emotions, not bad ideas. The terminal's demo session gives you separate practice funds at the same live prices, so those mistakes cost nothing." },
  { icon: "📊", h: "Real data, always", p: "Every quote, candle, market cap and coin profile on this site comes live from CoinGecko's public API. No fabricated feeds, no invented charts. The market you trade is the market that exists." },
  { icon: "🧮", h: "Honest mechanics", p: "Fees, spread, maintenance margin and liquidation formulas are the real ones, shown before every execution. If a strategy only 'works' when costs are hidden, it doesn't work." },
  { icon: "🔓", h: "Transparency over hype", p: "No fake testimonials, no invented awards, no manufactured urgency. This page tells you exactly what we are — and what we are not." },
];

export default function About() {
  const { user } = useApp();
  return (
    <>
      <PageHero crumb="About" title="What Vertex Trader is — and isn't" text="An honest description of this platform, because you deserve to know exactly what you're using." />

      <Section>
        <div className="container" style={{ maxWidth: 880 }}>
          <Reveal className="card" style={{ borderLeft: "3px solid var(--accent)", padding: "30px 34px" }}>
            <h2 style={{ fontSize: 24, marginBottom: 14 }}>The short version</h2>
            <p style={{ fontSize: 16, marginBottom: 14 }}>
              <b>Vertex Trader is a crypto trading platform.</b> You fund your wallet with crypto, then trade spot orders, limit orders, leveraged futures with real liquidation math, swaps and automated DCA bots — all executing against genuine live market data from CoinGecko.
            </p>
            <p style={{ fontSize: 16, marginBottom: 14 }}>
              <b>Funding is crypto-only and humanly verified:</b> every deposit and withdrawal is checked manually by our admin team before funds move. No card details, no bank rails, no automated payment processors — and nothing here is financial advice or a solicitation to trade.
            </p>
            <p style={{ fontSize: 16, marginBottom: 14 }}>
              <b>Demo mode lives in the terminal only:</b> a LIVE/DEMO switch gives you separate practice funds at the same live prices, so you can learn the mechanics without touching your balance.
            </p>
            <p style={{ fontSize: 16, color: "var(--muted)" }}>
              Accounts, passwords, sessions, two-factor authentication and KYC verification are real, working features — they protect your wallet and your history.
            </p>
          </Reveal>
        </div>
      </Section>

      <Section alt>
        <div className="container">
          <SectionHead kicker="Why we exist" title="Built around one belief" text="Nobody should learn leverage with real money." />
          <div className="grid-2">
            {VALUES.map((v, i) => (
              <Reveal key={v.h} delay={i * 0.07} className="card">
                <div className="icon">{v.icon}</div>
                <h3>{v.h}</h3><p>{v.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="container" style={{ maxWidth: 880 }}>
          <SectionHead kicker="Data & technology" title="How it works under the hood" text="" />
          <Reveal className="card" style={{ padding: "28px 32px" }}>
            <ul style={{ color: "var(--muted)", fontSize: 14.5, marginLeft: 20 }}>
              <li style={{ marginBottom: 10 }}><b style={{ color: "var(--text)" }}>Market data:</b> CoinGecko public API — live prices, OHLC history, market stats and coin profiles, polled every ~15–20 seconds with caching and rate-limit fallbacks.</li>
              <li style={{ marginBottom: 10 }}><b style={{ color: "var(--text)" }}>Accounts:</b> passwords hashed with scrypt + per-user salt, token-based sessions, RFC-6238 TOTP two-factor authentication, login history.</li>
              <li style={{ marginBottom: 10 }}><b style={{ color: "var(--text)" }}>KYC:</b> automated rule-based validation (field completeness, date-of-birth age check, document upload verification) with explicit rejection reasons — no human review queue, no rubber stamps.</li>
              <li><b style={{ color: "var(--text)" }}>Trading engine:</b> client-side execution against live prices — 0.10% spot fee, 0.05% futures fee, 4 bps spread, 0.5% maintenance margin, liquidation formula <code style={{ color: "var(--accent)" }}>entry × (1 ∓ 1/leverage ± MMR)</code>.</li>
            </ul>
          </Reveal>
          <Reveal className="risk-box" delay={0.1} style={{ marginTop: 26 }}>
            <h3>Risk warning</h3>
            <p>Cryptocurrency trading involves substantial risk and can result in the loss of your entire capital. Leveraged products amplify both gains and losses. Nothing on this platform constitutes financial advice. Practise here first — and if you ever trade with real money elsewhere, do so only with funds you can afford to lose.</p>
          </Reveal>
        </div>
      </Section>

      <Section alt>
        <div className="container">
          <CtaBand title={user ? `Welcome back, ${user.name.split(" ")[0]}` : "Your first trade is one click away"} text="Open the terminal and put the mechanics you just read about to work — against live market data.">
            <Btn to="/trade" className="btn btn-primary btn-lg">Launch Terminal</Btn>
            <Btn to="/strategies" className="btn btn-ghost btn-lg">Step-by-step guide</Btn>
          </CtaBand>
        </div>
      </Section>
    </>
  );
}
