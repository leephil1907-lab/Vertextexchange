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

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="copy-btn" onClick={(e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }).catch(() => { });
    }}>{done ? "✓ copied" : "copy"}</button>
  );
}

export default function Funding() {
  const { fiat, user, sessionMode } = useApp();
  const vs = CURRENCIES[fiat].vs;
  const [tab, setTab] = useState("deposit");
  const [coins, setCoins] = useState([]);
  const [methods, setMethods] = useState([]);
  const [methodId, setMethodId] = useState("");
  const [asset, setAsset] = useState(fiat);
  const [amount, setAmount] = useState("");
  const [txRef, setTxRef] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [reqs, setReqs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [, force] = useState(0);
  useEffect(() => paper.subscribe(() => force((v) => v + 1)), []);

  /* funding always operates on the LIVE wallet — temporarily re-attach if the
     trading session is in demo mode; restore on unmount */
  useEffect(() => {
    if (!user) return;
    if (sessionMode !== "live") { paper.init(user.id, "live"); paper.setFiat(fiat); }
    return () => {
      if (sessionMode !== "live") { paper.init(user.id, sessionMode); paper.setFiat(fiat); }
    };
  }, [sessionMode, user?.id, fiat]);

  useEffect(() => {
    getMarkets(vs, 1, 50).then((r) => Array.isArray(r.data) && setCoins(r.data)).catch(() => { });
    api.config().then((r) => setMethods(r.config?.paymentMethods || [])).catch(() => { });
    priceStore.configure(["bitcoin", "ethereum", "solana"], vs, 20000);
  }, [vs]);

  /* ---- verified funding requests (manual admin verification) ---- */
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

  const st = user ? paper.state : null;
  const method = methods.find((m) => m.id === methodId) || null;
  const assets = useMemo(() => {
    if (!st) return [];
    return [
      ...Object.keys(CURRENCIES).map((f) => ({ id: f, label: f, fiat: true, bal: st.balances.fiat[f] || 0 })),
      ...coins.map((c) => ({ id: c.id, label: c.symbol.toUpperCase(), fiat: false, bal: paper.coinBal(c.id), name: c.name })),
    ];
  }, [coins, st, force]);

  const cur = assets.find((a) => a.id === asset) || assets[0];
  const amt = parseFloat(amount) || 0;
  const pendingCount = reqs.filter((r) => r.status === "pending").length;
  const movements = (st?.history || []).filter((h) => h.kind === "deposit" || h.kind === "withdraw");

  const submitDeposit = async () => {
    setErr(null); setOkMsg(null);
    if (!method || !amt) return;
    setBusy(true);
    try {
      const r = await api.fundingRequest({ type: "deposit", methodId: method.id, amount: amt, txRef });
      setReqs((list) => [r.request, ...list]);
      setOkMsg(`Deposit request ${r.request.id} submitted — once our admin confirms your transfer on-chain, ${amt} ${method.symbol} is credited to your live wallet. You'll get a notification and email.`);
      setAmount(""); setTxRef("");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const submitWithdraw = async () => {
    setErr(null); setOkMsg(null);
    if (!amt || !cur || destAddress.trim().length < 8 || !network.trim()) return;
    setBusy(true);
    const held = paper.withdraw({ asset: cur.id, amount: amt }); // hold immediately
    if (!held) { setBusy(false); return; } // engine toasted the reason (insufficient balance)
    try {
      const r = await api.fundingRequest({ type: "withdraw", asset: cur.id, assetLabel: cur.label, amount: amt, destAddress: destAddress.trim(), network: network.trim() });
      setReqs((list) => [r.request, ...list]);
      setOkMsg(`Withdrawal request ${r.request.id} submitted — ${amt} ${cur.label} is held. After admin verification the payout is sent to your address and the request is marked approved.`);
      setAmount(""); setDestAddress(""); setNetwork("");
    } catch (e2) {
      paper.deposit({ asset: cur.id, amount: amt }); // refund hold on API failure
      setErr(e2.message);
    } finally { setBusy(false); }
  };

  const statsStrip = st && (
    <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
      <div className="stat-card"><div className="s-label">Live wallet ({fiat})</div><div className="s-value tnum">{fmtMoney(paper.fiatBal(), fiat)}</div></div>
      <div className="stat-card"><div className="s-label">Total equity</div><div className="s-value tnum">{fmtMoney(paper.equity(), fiat)}</div></div>
      <div className="stat-card"><div className="s-label">Pending verification</div><div className="s-value tnum">{user ? pendingCount : "—"}</div></div>
    </div>
  );

  const requestsTable = (
    <div className="table-wrap" style={{ marginBottom: 26 }}>
      <h3 style={{ fontSize: 15, margin: "4px 0 10px" }}>Verification requests {pendingCount > 0 && <span className="badge badge-new" style={{ marginLeft: 6 }}>{pendingCount} pending</span>}</h3>
      <table className="data" style={{ minWidth: 780 }}>
        <thead><tr><th>Request</th><th>Type</th><th>Asset</th><th className="num">Amount</th><th>Payment detail</th><th>Submitted</th><th>Status</th><th>Decision</th></tr></thead>
        <tbody>
          {reqs.length === 0 && <tr><td colSpan={8} style={{ color: "var(--muted)", textAlign: "center", padding: 22 }}>No requests yet. Deposits are credited after admin verification; withdrawals are paid out to your address after verification.</td></tr>}
          {reqs.map((r) => (
            <tr key={r.id}>
              <td className="tnum"><b>{r.id}</b></td>
              <td><span className={"badge " + (r.type === "deposit" ? "badge-pop" : "badge-hot")}>{r.type === "deposit" ? "↓ deposit" : "↑ withdraw"}</span></td>
              <td><b>{r.assetLabel || r.asset}</b></td>
              <td className="num tnum">{Number(r.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
              <td style={{ fontSize: 11.5, color: "var(--muted)", maxWidth: 200, wordBreak: "break-all" }}>
                {r.type === "deposit" ? (r.txRef ? <>tx: {r.txRef}</> : "awaiting tx reference") : (<>to: {r.destAddress}<br />{r.network}</>)}
              </td>
              <td className="tnum" style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</td>
              <td><span className={"badge " + (STATUS_BADGE[r.status] || "badge-new")}>{r.status}</span></td>
              <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 200 }}>
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
      <PageHero crumb="Funding" title="Deposit & withdraw" text="Fund your account with crypto — pick a receiving wallet, send your transfer, submit the reference and our admin team verifies it manually. Withdrawals are held, verified and paid out to your address." />
      <Section>
        <div className="container" style={{ maxWidth: 1040 }}>
          <Reveal className="auth-ok" style={{ marginBottom: 22, fontSize: 13.5 }}>
            🛡️ <b>Manual verification:</b> every deposit and withdrawal is reviewed by our admin team before funds move. Send deposits only from a wallet you control, on the exact network shown — transfers on the wrong network cannot be recovered.
          </Reveal>

          {statsStrip}

          {!user ? (
            <Reveal className="card" style={{ textAlign: "center", padding: "44px 30px" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
              <h2 style={{ fontSize: 22, marginBottom: 10 }}>Log in to fund your account</h2>
              <p style={{ color: "var(--muted)", maxWidth: 460, margin: "0 auto 22px", fontSize: 14.5 }}>
                Deposits and withdrawals are verified manually by our team, so funding requires an account — decisions, notifications and history stay tied to you.
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

              {tab === "deposit" && (
                <div style={{ padding: 24 }}>
                  {okMsg && <div className="auth-ok" style={{ marginBottom: 14, fontSize: 13.5 }}>{okMsg}</div>}
                  {err && <div className="auth-error" style={{ marginBottom: 14 }}>{err}</div>}
                  {methods.length === 0 ? (
                    <div className="empty-state" style={{ padding: "30px 16px" }}>
                      Deposit methods are being set up right now — none are published yet. Please check back shortly or <Link to="/support" style={{ color: "var(--accent)", fontWeight: 700 }}>contact support</Link>.
                    </div>
                  ) : (
                    <>
                      <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginBottom: 10, fontWeight: 600 }}>1 · Choose a payment method</label>
                      <div className="pm-grid">
                        {methods.map((m) => (
                          <button key={m.id} type="button" className={"pm-card" + (methodId === m.id ? " active" : "")} onClick={() => { setMethodId(m.id); setErr(null); }}>
                            <div className="pm-top">
                              <b className="pm-sym">{m.symbol}</b>
                              <span className="pm-net">{m.network}</span>
                            </div>
                            <code className="pm-addr">{m.address}</code>
                            <div className="pm-foot">
                              {m.note && <small>{m.note}</small>}
                              <CopyBtn text={m.address} />
                            </div>
                          </button>
                        ))}
                      </div>

                      {method && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pm-selected">
                          <div>
                            <div className="pm-sel-label">Send to ({method.symbol} · {method.network})</div>
                            <div className="pm-sel-addr"><code>{method.address}</code><CopyBtn text={method.address} /></div>
                          </div>
                          <div className="grid-2" style={{ gap: 14, marginTop: 16 }}>
                            <div className="field">
                              <label>2 · Amount you sent ({method.symbol})</label>
                              <div className="term-input">
                                <input type="number" min="0" step="any" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
                                <span className="suffix">{method.symbol}</span>
                              </div>
                            </div>
                            <div className="field">
                              <label>3 · Transaction hash / reference <small style={{ color: "var(--faint)", fontWeight: 500 }}>(after sending)</small></label>
                              <input value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="TxID from your wallet — speeds up verification" style={{ width: "100%" }} />
                            </div>
                          </div>
                          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="btn btn-block btn-lg btn-buy" disabled={!amt || busy} onClick={submitDeposit}>
                            {busy ? "Submitting…" : `Submit deposit for verification${amt ? ` · ${amt} ${method.symbol}` : ""}`}
                          </motion.button>
                          <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 10, textAlign: "center" }}>
                            Send exactly on the <b>{method.network}</b> network. Your deposit is credited to your live wallet after admin verification — status updates appear here and by email.
                          </p>
                        </motion.div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "withdraw" && (
                <div style={{ padding: 24 }}>
                  {okMsg && <div className="auth-ok" style={{ marginBottom: 14, fontSize: 13.5 }}>{okMsg}</div>}
                  {err && <div className="auth-error" style={{ marginBottom: 14 }}>{err}</div>}
                  <div className="grid-2" style={{ gap: 20, alignItems: "start" }}>
                    <div>
                      <div className="field">
                        <label>Asset</label>
                        <select value={asset} onChange={(e) => { setAsset(e.target.value); setAmount(""); }}>
                          <optgroup label="Fiat wallets">
                            {assets.filter((a) => a.fiat).map((a) => <option key={a.id} value={a.id}>{a.id} — balance {a.bal.toFixed(2)}</option>)}
                          </optgroup>
                          <optgroup label="Crypto">
                            {assets.filter((a) => !a.fiat).map((a) => <option key={a.id} value={a.id}>{a.label} — balance {fmtN(a.bal, 5)}</option>)}
                          </optgroup>
                        </select>
                      </div>
                      <div className="field">
                        <label>Your receiving wallet address</label>
                        <input value={destAddress} onChange={(e) => setDestAddress(e.target.value)} placeholder="e.g. bc1q… / 0x… / T… — double-check every character" style={{ width: "100%", fontFamily: "var(--mono, monospace)", fontSize: 13 }} />
                      </div>
                      <div className="field">
                        <label>Network</label>
                        <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="e.g. Bitcoin, Ethereum (ERC-20), Tron (TRC-20)" style={{ width: "100%" }} list="net-list" />
                        <datalist id="net-list">
                          {[...new Set(methods.map((m) => m.network))].filter(Boolean).map((n) => <option key={n} value={n} />)}
                        </datalist>
                      </div>
                      <div className="field">
                        <label>Amount</label>
                        <div className="term-input">
                          <input type="number" min="0" step="any" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
                          <span className="suffix">{cur?.label}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                        <button className="chip-toggle" onClick={() => setAmount(String(Number(cur?.bal || 0).toPrecision(6)))}>all balance</button>
                        <button className="chip-toggle" onClick={() => setAmount(String(Number((cur?.bal || 0) / 2).toPrecision(6)))}>50%</button>
                      </div>
                      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="btn btn-block btn-lg btn-sell"
                        disabled={!amt || busy || destAddress.trim().length < 8 || !network.trim()} onClick={submitWithdraw}>
                        {busy ? "Submitting…" : `Submit withdrawal request${amt ? ` · ${amt} ${cur?.label || ""}` : ""}`}
                      </motion.button>
                      <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 10, textAlign: "center" }}>
                        The amount is held from your live wallet immediately. After admin verification the payout is sent manually to your address — and refunded automatically if declined.
                      </p>
                    </div>
                    <div className="card" style={{ background: "var(--bg-elev)", boxShadow: "none" }}>
                      <h3 style={{ fontSize: 15 }}>Summary</h3>
                      {[
                        ["Asset", cur?.fiat ? cur.id : `${cur?.label}${cur?.name ? " · " + cur.name : ""}`],
                        ["Available balance", <b className="tnum" key="b">{cur ? (cur.fiat ? cur.bal.toFixed(2) : fmtN(cur.bal)) : "—"}</b>],
                        ["Amount", <b className="tnum down" key="a">−{amt || 0}</b>],
                        ["Destination", <b key="d" style={{ fontSize: 11.5, wordBreak: "break-all", maxWidth: 190, textAlign: "right" }}>{destAddress || "—"}</b>],
                        ["Network", <b key="n">{network || "—"}</b>],
                        ["Verification", <b key="v" style={{ color: "var(--accent-2)" }}>manual · by admin</b>],
                      ].map(([l, v], i) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: i < 5 ? "1px solid var(--line)" : "none", fontSize: 13.5 }}>
                          <span style={{ color: "var(--muted)" }}>{l}</span>{typeof v === "string" ? <b>{v}</b> : v}
                        </div>
                      ))}
                      {!cur?.fiat && cur && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                          <span style={{ color: "var(--muted)" }}>Live value</span>
                          <b className="tnum">{fmtMoney((priceStore.price(cur.id) || 0) * amt, fiat)}</b>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "history" && (
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
          {pendingCount > 0 && tab !== "history" && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginTop: 16 }}>
              ⏳ {pendingCount} request{pendingCount > 1 ? "s" : ""} awaiting admin verification — statuses refresh automatically every 30s.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
