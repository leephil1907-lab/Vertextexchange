import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Reveal, Btn, Section, PageHero } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { api } from "../services/api.js";
import { paper } from "../engine/paper.js";
import { getMarkets, CURRENCIES, fmtMoney, priceStore } from "../services/coingecko.js";

const fmtN = (n, p = 6) => (n == null ? "—" : Number(n).toPrecision(p));
const STATUS_BADGE = { pending: "badge-new", approved: "badge-pop", rejected: "badge-hot" };

export default function Funding() {
  const { fiat, user } = useApp();
  const vs = CURRENCIES[fiat].vs;
  const [tab, setTab] = useState("deposit");
  const [coins, setCoins] = useState([]);
  const [asset, setAsset] = useState(fiat);
  const [amount, setAmount] = useState("");
  const [reqs, setReqs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [, force] = useState(0);
  useEffect(() => paper.subscribe(() => force((v) => v + 1)), []);
  useEffect(() => {
    getMarkets(vs, 1, 50).then((r) => Array.isArray(r.data) && setCoins(r.data)).catch(() => { });
    priceStore.configure(["bitcoin", "ethereum", "solana"], vs, 20000);
  }, [vs]);

  /* ---- server-side funding requests (verified manually by admin) ---- */
  const appliedKey = user ? `vt_funding_applied:${user.id}` : null;
  const applyDecisions = useCallback((list) => {
    if (!appliedKey) return;
    let applied = [];
    try { applied = JSON.parse(localStorage.getItem(appliedKey) || "[]"); } catch (e) { }
    let changed = false;
    for (const r of list) {
      if (r.status === "pending" || applied.includes(r.id)) continue;
      if (r.status === "approved" && r.type === "deposit") paper.deposit({ asset: r.asset, amount: r.amount });
      if (r.status === "rejected" && r.type === "withdraw") paper.deposit({ asset: r.asset, amount: r.amount }); // refund held funds
      applied.push(r.id);
      changed = true;
    }
    if (changed) localStorage.setItem(appliedKey, JSON.stringify(applied.slice(-300)));
  }, [appliedKey]);

  const loadReqs = useCallback(() => {
    if (!user) { setReqs([]); return; }
    api.myFunding().then((res) => { const list = res.requests || []; setReqs(list); applyDecisions(list); }).catch(() => { });
  }, [user?.id, applyDecisions]);

  useEffect(() => { loadReqs(); const t = setInterval(loadReqs, 30000); return () => clearInterval(t); }, [loadReqs]);

  const st = paper.state;
  const assets = useMemo(() => [
    ...Object.keys(CURRENCIES).map((f) => ({ id: f, label: f, fiat: true, bal: st?.balances.fiat[f] || 0 })),
    ...coins.map((c) => ({ id: c.id, label: c.symbol.toUpperCase(), fiat: false, bal: paper.coinBal(c.id), image: c.image, name: c.name })),
  ], [coins, st, force]);
  if (!st) return <div className="spinner" />;

  const cur = assets.find((a) => a.id === asset) || assets[0];
  const amt = parseFloat(amount) || 0;
  const after = cur ? (tab === "deposit" ? cur.bal + amt : cur.bal - amt) : 0;
  const movements = st.history.filter((h) => h.kind === "deposit" || h.kind === "withdraw");
  const chips = cur?.fiat ? [100, 1000, 10000] : [0.01, 0.1, 1];
  const pendingCount = reqs.filter((r) => r.status === "pending").length;
  const label = cur?.fiat ? asset : cur?.label;

  const exec = async () => {
    setErr(null); setOkMsg(null);
    if (!amt || busy) return;
    setBusy(true);
    try {
      if (tab === "withdraw") {
        const held = paper.withdraw({ asset, amount: amt }); // reserve immediately (honest hold)
        if (!held) return; // paper engine toasted the reason (insufficient balance)
        try {
          const r = await api.fundingRequest("withdraw", asset, label, amt);
          setReqs((list) => [r.request, ...list]);
          setOkMsg(`Withdrawal request ${r.request.id} submitted — funds are held until an admin verifies the request.`);
        } catch (e2) {
          paper.deposit({ asset, amount: amt }); // refund hold on API failure
          setErr(e2.message);
        }
      } else {
        const r = await api.fundingRequest("deposit", asset, label, amt);
        setReqs((list) => [r.request, ...list]);
        setOkMsg(`Deposit request ${r.request.id} submitted — it will be credited to your wallet after admin verification.`);
      }
      setAmount("");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const statsStrip = (
    <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
      <div className="stat-card"><div className="s-label">Wallet ({fiat})</div><div className="s-value tnum">{fmtMoney(paper.fiatBal(), fiat)}</div></div>
      <div className="stat-card"><div className="s-label">Total equity</div><div className="s-value tnum">{fmtMoney(paper.equity(), fiat)}</div></div>
      <div className="stat-card"><div className="s-label">Pending verification</div><div className="s-value tnum">{user ? pendingCount : "—"}</div></div>
    </div>
  );

  const requestsTable = (
    <div className="table-wrap" style={{ marginBottom: 26 }}>
      <h3 style={{ fontSize: 15, margin: "4px 0 10px" }}>Verification requests {pendingCount > 0 && <span className="badge badge-new" style={{ marginLeft: 6 }}>{pendingCount} pending</span>}</h3>
      <table className="data" style={{ minWidth: 720 }}>
        <thead><tr><th>Request</th><th>Type</th><th>Asset</th><th className="num">Amount</th><th>Submitted</th><th>Status</th><th>Decision</th></tr></thead>
        <tbody>
          {reqs.length === 0 && <tr><td colSpan={7} style={{ color: "var(--muted)", textAlign: "center", padding: 22 }}>No requests yet — submit a deposit or withdrawal above. Every request is verified manually by an admin.</td></tr>}
          {reqs.map((r) => (
            <tr key={r.id}>
              <td className="tnum"><b>{r.id}</b></td>
              <td><span className={"badge " + (r.type === "deposit" ? "badge-pop" : "badge-hot")}>{r.type === "deposit" ? "↓ deposit" : "↑ withdraw"}</span></td>
              <td><b>{r.assetLabel || r.asset}</b></td>
              <td className="num tnum">{Number(r.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
              <td className="tnum">{new Date(r.createdAt).toLocaleString()}</td>
              <td><span className={"badge " + (STATUS_BADGE[r.status] || "badge-new")}>{r.status}</span></td>
              <td style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 220 }}>
                {r.status === "pending" ? "awaiting admin verification" : <>
                  {new Date(r.decidedAt).toLocaleString()}
                  {r.reason && <><br /><span style={{ color: "var(--down)" }}>reason: {r.reason}</span></>}
                </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const movementsTable = (
    <div className="table-wrap">
      <h3 style={{ fontSize: 15, margin: "4px 0 10px" }}>Wallet movements</h3>
      <table className="data" style={{ minWidth: 640 }}>
        <thead><tr><th>Time</th><th>Type</th><th>Asset</th><th className="num">Amount</th><th className="num">Reference price</th><th>Status</th></tr></thead>
        <tbody>
          {movements.length === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: 22 }}>No wallet movements yet — verified deposits appear here once credited.</td></tr>}
          {movements.map((h) => (
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
  );

  return (
    <>
      <PageHero crumb="Funding" title="Fund your paper wallet" text="Submit deposit and withdrawal requests, track their verification and review every movement. All requests are verified manually by our admin team — and the wallet stays 100% virtual: no real money, no payment processor, ever." />
      <Section>
        <div className="container" style={{ maxWidth: 1000 }}>
          <Reveal className="auth-ok" style={{ marginBottom: 22, fontSize: 13.5 }}>
            🛡️ <b>Manual verification:</b> every deposit and withdrawal is reviewed and approved by an admin before funds move. Deposits credit after approval; withdrawals hold the funds immediately and refund automatically if declined. You'll get an in-app notification and an email on every decision.
          </Reveal>

          {statsStrip}

          {!user ? (
            <Reveal className="card" style={{ textAlign: "center", padding: "44px 30px" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
              <h2 style={{ fontSize: 22, marginBottom: 10 }}>Log in to submit funding requests</h2>
              <p style={{ color: "var(--muted)", maxWidth: 460, margin: "0 auto 22px", fontSize: 14.5 }}>
                Because every request is verified manually by our admin team, funding requires an account — so verification decisions, notifications and history are tied to you. Your terminal wallet still works as a guest.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Btn to="/login" className="btn btn-primary btn-lg">Log in</Btn>
                <Btn to="/signup" className="btn btn-ghost btn-lg">Create free account</Btn>
              </div>
            </Reveal>
          ) : (
            <Reveal className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="order-tabs">
                {[["deposit", "↓ Deposit"], ["withdraw", "↑ Withdraw"], ["history", "🕘 History"]].map(([k, l]) => (
                  <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
                ))}
              </div>

              {tab !== "history" ? (
                <div style={{ padding: 24 }}>
                  {okMsg && <div className="auth-ok" style={{ marginBottom: 14, fontSize: 13.5 }}>{okMsg}</div>}
                  {err && <div className="auth-error" style={{ marginBottom: 14 }}>{err}</div>}
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
                          <span className="suffix">{label}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                        {chips.map((c) => (
                          <button key={c} className="chip-toggle" onClick={() => setAmount(String(c))}>+{c}</button>
                        ))}
                        {tab === "withdraw" && (
                          <button className="chip-toggle" onClick={() => setAmount(String(Number(cur?.bal || 0).toPrecision(6)))}>all balance</button>
                        )}
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        className={"btn btn-block btn-lg " + (tab === "deposit" ? "btn-buy" : "btn-sell")}
                        disabled={!amt || busy} onClick={exec}>
                        {busy ? "Submitting…" : tab === "deposit" ? `Submit deposit request${amt ? ` · ${amt} ${label}` : ""}` : `Submit withdrawal request${amt ? ` · ${amt} ${label}` : ""}`}
                      </motion.button>
                      <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 12, textAlign: "center" }}>
                        {tab === "deposit"
                          ? "Deposits are credited after an admin verifies the request. Single requests capped at 10,000,000 (virtual)."
                          : "The amount is held from your balance immediately and refunded automatically if the admin declines the request."}
                      </p>
                    </div>
                    <div className="card" style={{ background: "var(--bg-elev)", boxShadow: "none" }}>
                      <h3 style={{ fontSize: 15 }}>Summary</h3>
                      {[
                        ["Asset", cur?.fiat ? asset : `${cur?.label} · ${cur?.name || ""}`],
                        ["Current balance", <b className="tnum" key="b">{cur?.fiat ? cur.bal.toFixed(2) : fmtN(cur?.bal)}</b>],
                        [tab === "deposit" ? "Deposit" : "Withdrawal", <b className={"tnum " + (tab === "deposit" ? "up" : "down")} key="a">{tab === "deposit" ? "+" : "−"}{amt || 0}</b>],
                        [tab === "deposit" ? "Balance after approval" : "Held immediately", <b className="tnum" key="af" style={{ color: after < 0 ? "var(--down)" : "var(--accent)" }}>{cur?.fiat ? after.toFixed(2) : fmtN(after)}</b>],
                        ["Verification", <b key="v" style={{ color: "var(--accent-2)" }}>manual · by admin</b>],
                      ].map(([l, v], i) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: i < 4 ? "1px solid var(--line)" : "none", fontSize: 13.5 }}>
                          <span style={{ color: "var(--muted)" }}>{l}</span>{typeof v === "string" ? <b>{v}</b> : v}
                        </div>
                      ))}
                      {!cur?.fiat && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                          <span style={{ color: "var(--muted)" }}>Live value</span>
                          <b className="tnum">{fmtMoney((priceStore.price(asset) || 0) * amt, fiat)}</b>
                        </div>
                      )}
                      <Link className="more" to="/trade" style={{ display: "inline-block", marginTop: 12 }}>Trade with these funds →</Link>
                    </div>
                  </div>
                  {pendingCount > 0 && (
                    <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginTop: 16 }}>
                      ⏳ You have {pendingCount} request{pendingCount > 1 ? "s" : ""} awaiting admin verification — this page refreshes statuses automatically every 30s.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ padding: 24 }}>
                  {requestsTable}
                  {movementsTable}
                </div>
              )}
            </Reveal>
          )}

          {user && tab !== "history" && reqs.length > 0 && (
            <Reveal style={{ marginTop: 22 }}>{requestsTable}</Reveal>
          )}
        </div>
      </Section>
    </>
  );
}
