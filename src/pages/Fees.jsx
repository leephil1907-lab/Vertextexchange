import { Reveal, Btn, Section, SectionHead, PageHero } from "../components/ui.jsx";
import { SPOT_FEE, FUTURES_FEE, SPREAD_BPS, MMR } from "../engine/paper.js";

const pct = (x) => (x * 100).toFixed(2) + "%";

export default function Fees() {
  return (
    <>
      <PageHero crumb="Fees" title="Transparent cost model" text="No hidden charges, no spreads stuffed into a mystery line item. Because this is a paper-trading platform, no real money is ever charged — but these are the exact costs the simulation applies, so your practice reflects real trading friction." />
      <Section>
        <div className="container">
          <Reveal className="table-wrap" style={{ maxWidth: 860, margin: "0 auto" }}>
            <table className="data">
              <thead><tr><th>Item</th><th className="num">Rate</th><th>How it's applied</th></tr></thead>
              <tbody>
                <tr><td>Spot trading fee</td><td className="num tnum">{pct(SPOT_FEE)}</td><td>Charged on the notional of every market, limit, DCA and swap execution. Shown before you confirm each order.</td></tr>
                <tr><td>Futures trading fee</td><td className="num tnum">{pct(FUTURES_FEE)}</td><td>Charged on position notional (margin × leverage) at open and again at close.</td></tr>
                <tr><td>Execution spread</td><td className="num tnum">{SPREAD_BPS / 100}% ({SPREAD_BPS} bps)</td><td>Applied to the real mid price to model realistic fills — slightly worse for you on every execution.</td></tr>
                <tr><td>Maintenance margin (futures)</td><td className="num tnum">{pct(MMR)}</td><td>The buffer between zero equity and liquidation; used in the liquidation-price formula.</td></tr>
                <tr><td>Deposits & withdrawals</td><td className="num">—</td><td>Not applicable: the wallet is virtual. There is nothing to deposit or withdraw.</td></tr>
                <tr><td>Account / inactivity / platform fees</td><td className="num">—</td><td>None. Free forever.</td></tr>
                <tr><td>Market data</td><td className="num">—</td><td>Live CoinGecko data, free to all users.</td></tr>
              </tbody>
            </table>
          </Reveal>

          <Reveal className="card" delay={0.1} style={{ maxWidth: 860, margin: "40px auto 0" }}>
            <h3>Worked example — spot buy</h3>
            <p style={{ fontSize: 14.5 }}>
              You buy €1,000 of BTC at a live price of €50,000. The spread shifts your fill to about €50,020 (4 bps against you). Your notional is €1,000, so the spot fee is €{SPOT_FEE * 1000}. You receive 1000 ÷ 50,020 ≈ 0.019992 BTC. Total cost: €1,001 including fee — and both the spread and the fee are visible in the order panel before you click.
            </p>
          </Reveal>
          <Reveal className="card" delay={0.15} style={{ maxWidth: 860, margin: "18px auto 0" }}>
            <h3>Worked example — futures long</h3>
            <p style={{ fontSize: 14.5 }}>
              You post €100 margin at 10x: notional €1,000. Opening fee = €{FUTURES_FEE * 1000}. Liquidation sits at entry × (1 − 1/10 + {MMR}) ≈ −9.5% from entry — not −10%, because maintenance margin cushions the math. Close at +5%: gross P&L €50, minus €{FUTURES_FEE * 1000} close fee. The ROE column in your positions panel shows all of this live.
            </p>
          </Reveal>

          <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 13, marginTop: 36 }}>
            Real exchanges charge different rates (often 0.02–0.10% for retail spot). Our model sits at the conservative end so practice results aren't flattered.
          </p>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <Btn to="/trade" className="btn btn-primary btn-lg">See fees in action →</Btn>
          </div>
        </div>
      </Section>
    </>
  );
}
