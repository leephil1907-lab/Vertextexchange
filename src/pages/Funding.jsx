import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Reveal, Section, PageHero } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { paper } from "../engine/paper.js";
import { getMarkets, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";

const fmtN = (n, p = 6) => (n == null ? "—" : Number(n).toPrecision(p));

export default function Funding() {
  const { fiat } = useApp();
  const vs = CURRENCIES[fiat].vs;
  const [tab, setTab] = useState("deposit");
  const [coins, setCoins] = useState([]);
  const [asset, setAsset] = useState(fiat);
  const [amount, setAmount] = useState("");
  const [, force] = useState(0);
  useEffect(() => paper.subscribe(() => force((v) => v + 1)), []);
  useEffect(() => {
    getMarkets(vs, 1, 50).then((r) => Array.isArray(r.data) && setCoins(r.data)).catch(() => { });
    priceStore.configure(["bitcoin", "ethereum", "solana"], vs, 20000);
  }, [vs]);

  const st = paper.state;
  const assets = useMemo(() => [
    ...Object.keys(CURRENCIES).map((f) => ({ id: f, label: f, fiat: true, bal: st?.balances.fiat[f] || 0 })),
    ...coins.map((c) => ({ id: c.id, label: c.symbol.toUpperCase(), fiat: false, bal: paper.coinBal(c.id), image: c.image, name: c.name })),
  ], [coins, st, force]);
  if (!st) return <div className="spinner" />;

  const cur = assets.find((a) => a.id === asset) || assets[0];
  const amt = parseFloat(amount) || 0;
  const after = cur ? (tab === "deposit" ? cur.bal + amt : cur.bal - amt) : 0;
  const funding = st.history.filter((h) => h.kind === "deposit" || h.kind === "withdraw");
  const chips = cur?.fiat ? [100, 1000, 10000] : [0.01, 0.1, 1];

  const exec = () => {
    const ok = tab === "deposit" ? paper.deposit({ asset, amount: amt }) : paper.withdraw({ asset, amount: amt });
    if (ok) setAmount("");
  };

  return (
    <>
      <PageHero crumb="Funding" title="Fund your paper wallet" text="Deposit and withdraw virtual funds, and review every funding movement. This wallet is virtual — no real money enters or leaves, ever." />
      <Section>
        <div className="container" style={{ maxWidth: 1000 }}>
          <Reveal className="auth-ok" style={{ marginBottom: 22, fontSize: 13.5 }}>
            💶 Virtual funding only: deposits top up your practice wallet, withdrawals move funds out of it. Balances feed the terminal, DCA bots and futures margin instantly.
          </Reveal>

          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
            <div className="stat-card"><div className="s-label">Wallet ({fiat})</div><div className="s-value tnum">{fmtMoney(paper.fiatBal(), fiat)}</div></div>
            <div className="stat-card"><div className="s-label">Total equity</div><div className="s-value tnum">{fmtMoney(paper.equity(), fiat)}</div></div>
            <div className="stat-card"><div className="s-label">Funding movements</div><div className="s-value tnum">{funding.length}</div></div>
          </div>

          <Reveal className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="order-tabs">
              {[["deposit", "↓ Deposit"], ["withdraw", "↑ Withdraw"], ["history", "🕘 History"]].map(([k, l]) => (
                <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab !== "history" ? (
              <div style={{ padding: 24 }}>
                <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
                  <div>
                    <div className="field">
                      <label>Asset</label>
                      <select value={asset} onChange={(e) => { setAsset(e.target.value); setAmount(""); }}>
                        <optgroup label="Fiat wallets">
                          {assets.filter((a) => a.fiat).map((a) => <option key={a.id} value={a.id}>{a.id} — balance {a.bal.toFixed(2)}</option>)}
                        </optgroup>
                        <optgroup label="Cryptocurrencies (live prices)">
                          {assets.filter((a) => !a.fiat).map((a) => <option key={a.id} value={a.id}>{a.label} — balance {fmtN(a.bal, 5)}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div className="field">
                      <label>{tab === "deposit" ? "Amount to deposit" : "Amount to withdraw"}</label>
                      <div className="term-input">
                        <input type="number" min="0" step="any" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
                        <span className="suffix">{cur?.fiat ? asset : cur?.label}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                      {chips.map((c) => (
                        <button key={c} className="chip-toggle" onClick={() => setAmount(String(c))}>+{c}</button>
                      ))}
                      <button className="chip-toggle" onClick={() => setAmount(String(Number(cur?.bal || 0).toPrecision(6)))}>
                        {tab === "deposit" ? "max demo 10,000,000" : "all balance"}
                      </button>
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className={"btn btn-block btn-lg " + (tab === "deposit" ? "btn-buy" : "btn-sell")}
                      disabled={!amt} onClick={exec}>
                      {tab === "deposit" ? `Deposit ${amt || ""} ${cur?.fiat ? asset : cur?.label || ""}` : `Withdraw ${amt || ""} ${cur?.fiat ? asset : cur?.label || ""}`}
                    </motion.button>
                    <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 12, textAlign: "center" }}>
                      {tab === "deposit"
                        ? "Deposits credit instantly and are logged in History. Single deposits capped at 10,000,000 (virtual)."
                        : "Withdrawals debit instantly; you can't withdraw more than your available balance."}
                    </p>
                  </div>
                  <div className="card" style={{ background: "var(--bg-elev)", boxShadow: "none" }}>
                    <h3 style={{ fontSize: 15 }}>Summary</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                      <span style={{ color: "var(--muted)" }}>Asset</span><b>{cur?.fiat ? asset : `${cur?.label} · ${cur?.name || ""}`}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                      <span style={{ color: "var(--muted)" }}>Current balance</span><b className="tnum">{cur?.fiat ? cur.bal.toFixed(2) : fmtN(cur?.bal)}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                      <span style={{ color: "var(--muted)" }}>{tab === "deposit" ? "Deposit" : "Withdraw"}</span>
                      <b className={"tnum " + (tab === "deposit" ? "up" : "down")}>{tab === "deposit" ? "+" : "−"}{amt || 0}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", fontSize: 13.5 }}>
                      <span style={{ color: "var(--muted)" }}>Balance after</span>
                      <b className="tnum" style={{ color: after < 0 ? "var(--down)" : "var(--accent)" }}>{cur?.fiat ? after.toFixed(2) : fmtN(after)}</b>
                    </div>
                    {!cur?.fiat && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                        <span style={{ color: "var(--muted)" }}>Live value</span>
                        <b className="tnum">{fmtMoney((priceStore.price(asset) || 0) * amt, fiat)}</b>
                      </div>
                    )}
                    <Link className="more" to="/trade" style={{ display: "inline-block", marginTop: 12 }}>Trade with these funds →</Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data" style={{ minWidth: 640 }}>
                  <thead><tr><th>Time</th><th>Type</th><th>Asset</th><th className="num">Amount</th><th className="num">Reference price</th><th>Status</th></tr></thead>
                  <tbody>
                    {funding.length === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: 26 }}>No funding movements yet — make your first deposit above.</td></tr>}
                    {funding.map((h) => (
                      <tr key={h.id}>
                        <td className="tnum">{new Date(h.time).toLocaleString()}</td>
                        <td><span className={"badge " + (h.kind === "deposit" ? "badge-pop" : "badge-hot")}>{h.kind === "deposit" ? "↓ deposit" : "↑ withdraw"}</span></td>
                        <td><b>{h.fiat}</b></td>
                        <td className={"num tnum " + (h.kind === "deposit" ? "up" : "down")}>{h.kind === "deposit" ? "+" : "−"}{Number(h.qty).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                        <td className="num tnum">{h.price ? fmtN(h.price) : "—"}</td>
                        <td className="up"><b>completed</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Reveal>
        </div>
      </Section>
    </>
  );
}
