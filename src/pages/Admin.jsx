import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Reveal, Section } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { api } from "../services/api.js";

const TABS = [["overview", "📊 Overview"], ["composer", "✉️ Email Composer"], ["tickets", "🎫 Tickets"], ["funding", "💶 Funding"], ["users", "👥 Users"], ["announce", "📢 Announcement"], ["outbox", "📤 Outbox"]];

function Overview({ stats }) {
  if (!stats) return <div className="spinner" />;
  const cells = [
    ["Registered users", stats.users, ""],
    ["KYC verified", stats.verified, ""],
    ["Open tickets", stats.ticketsOpen, stats.ticketsOpen ? "down" : "up"],
    ["Funding pending", stats.fundingPending ?? 0, stats.fundingPending ? "down" : "up"],
    ["Total tickets", stats.ticketsTotal, ""],
    ["Emails sent", stats.emailsSent, "up"],
    ["Emails queued", stats.emailsQueued, stats.emailsQueued ? "" : ""],
    ["Emails failed", stats.emailsFailed, stats.emailsFailed ? "down" : "up"],
    ["Newsletter subs", stats.subscribers, ""],
  ];
  return (
    <>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {cells.map(([l, v, cls]) => (
          <div key={l} className="stat-card"><div className="s-label">{l}</div><div className={"s-value tnum " + cls}>{v}</div></div>
        ))}
      </div>
      <Reveal className={"auth-" + (stats.emailEnabled ? "ok" : "error")}>
        {stats.emailEnabled
          ? "✓ SMTP delivery configured — composer sends reach inboxes immediately."
          : "⚠ SMTP not configured on this server: composed emails are stored in each user's outbox with status \"queued\" and appear in their notification feed. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to enable real delivery."}
      </Reveal>
    </>
  );
}

function Composer() {
  const [users, setUsers] = useState(null);
  const [mode, setMode] = useState("all");
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.adminUsers().then((r) => setUsers(r.users)).catch(() => { }); }, []);

  const to = mode === "all" ? "all" : mode === "user" ? userId : userId;
  const previewHtml = `<!DOCTYPE html><html><body style="margin:0;background:#070b14;">${/* server renders identical markup; preview approximates via fetch-free template */ ""}</body></html>`;
  void previewHtml;

  const send = async () => {
    setErr(null); setRes(null); setBusy(true);
    try {
      const r = await api.adminSendEmail({ to: mode === "all" ? "all" : userId, subject, body, ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined });
      setRes(r);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <Reveal className="card">
        <h3>Compose email</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Every message is wrapped in the branded Vertex Trader template (navy canvas, emerald accents, risk footer) and logged to each recipient's outbox with its true delivery status.</p>
        <div className="field"><label>Audience</label>
          <div className="chip-toggle" style={{ marginBottom: 10 }}>
            <button type="button" className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All users</button>
            <button type="button" className={mode === "user" ? "active" : ""} onClick={() => setMode("user")}>Single user</button>
          </div>
          {mode === "user" && (
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select recipient…</option>
              {(users || []).filter((u) => u.role !== "admin").map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
            </select>
          )}
        </div>
        <div className="field"><label>Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New: equity curve export in your dashboard" /></div>
        <div className="field"><label>Message (blank line = new paragraph)</label>
          <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Hi trader,\n\nWe just shipped ..."} />
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field"><label>Button label (optional)</label><input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Open the terminal" /></div>
          <div className="field"><label>Button link (optional)</label><input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…/trade" /></div>
        </div>
        {err && <div className="auth-error">{err}</div>}
        {res && (
          <div className="auth-ok">
            ✓ Handed {res.sent} email(s) to the delivery pipeline ({res.emailEnabled ? "SMTP live" : "queued — SMTP not configured"}).
            <ul style={{ margin: "8px 0 0 18px", fontSize: 12.5 }}>{res.results.map((r) => <li key={r.email}>{r.email} → {r.status}</li>)}</ul>
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || (mode === "user" && !userId)} onClick={send}>
          {busy ? "Sending…" : "Send with branded template"}
        </button>
      </Reveal>
      <Reveal className="card" delay={0.07} style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Live template preview</h3>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>exactly what recipients get</span>
        </div>
        <ComposerPreview subject={subject} body={body} ctaLabel={ctaLabel} />
      </Reveal>
    </div>
  );
}

/* mirrors server brandEmail() markup so admins see the real design before sending */
function ComposerPreview({ subject, body, ctaLabel }) {
  const paras = (body || "Your message paragraphs appear here — the template adds the header, accent bar, risk card and footer automatically.").split(/\n{2,}/).map((p, i) => (
    <p key={i} style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.65, color: "#c7d2e4" }}>{p}</p>
  ));
  return (
    <div style={{ background: "#070b14", padding: "24px 14px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #1d2b47", background: "#0b1120" }}>
        <div style={{ background: "#0d1526", borderBottom: "1px solid #1d2b47", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}><span style={{ color: "#B8F229" }}>▲</span> VERTEX<span style={{ color: "#4f8cff" }}>TRADER</span></span>
          <span style={{ fontSize: 10, color: "#6b7a94", letterSpacing: ".08em", textTransform: "uppercase" }}>Live market data · verified crypto funding</span>
        </div>
        <div style={{ padding: "8px 24px 0" }}><div style={{ height: 3, borderRadius: 2, background: "#B8F229" }} /></div>
        <div style={{ padding: "22px 24px 6px" }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 21, lineHeight: 1.3, color: "#fff" }}>{subject || "Your subject line"}</h1>
          {paras}
          {ctaLabel && <span style={{ display: "inline-block", padding: "11px 24px", borderRadius: 10, background: "#7CBF0F", color: "#fff", fontWeight: 700, fontSize: 14 }}>{ctaLabel}</span>}
        </div>
        <div style={{ padding: "0 24px 22px" }}>
          <div style={{ borderRadius: 12, background: "#0d1526", border: "1px solid #1d2b47", padding: "12px 16px", fontSize: 12, lineHeight: 1.6, color: "#8fa0ba" }}>
            <b style={{ color: "#c7d2e4" }}>Risk warning:</b> cryptocurrency trading involves substantial risk; leveraged products can liquidate your margin. Deposits and withdrawals are verified manually by our team, and nothing here is financial advice.
          </div>
        </div>
        <div style={{ background: "#0d1526", borderTop: "1px solid #1d2b47", padding: "14px 24px", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7a94" }}>
          <span>© 2026 Vertex Trader</span>
          <span><span style={{ color: "#B8F229" }}>Support</span> · <span style={{ color: "#B8F229" }}>Email preferences</span> · <span style={{ color: "#B8F229" }}>Terminal</span></span>
        </div>
      </div>
    </div>
  );
}

function Tickets() {
  const [tickets, setTickets] = useState(null);
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.adminTickets().then((r) => { setTickets(r.tickets); if (!sel && r.tickets[0]) setSel(r.tickets[0].id); }).catch(() => { });
  useEffect(() => { load(); }, []);
  const t = (tickets || []).find((x) => x.id === sel);
  const send = async () => {
    setBusy(true);
    try { const r = await api.adminReplyTicket(sel, reply); setTickets((cur) => cur.map((x) => (x.id === sel ? r.ticket : x))); setReply(""); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const setStatus = async (s) => {
    try { const r = await api.adminTicketStatus(sel, s); setTickets((cur) => cur.map((x) => (x.id === sel ? r.ticket : x))); } catch (e) { alert(e.message); }
  };
  if (!tickets) return <div className="spinner" />;
  return (
    <div className="grid-2" style={{ alignItems: "start", gridTemplateColumns: "340px 1fr" }}>
      <Reveal className="card" style={{ padding: 10, maxHeight: 560, overflowY: "auto" }}>
        {tickets.length === 0 && <div className="empty-state">No tickets yet.</div>}
        {tickets.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)} style={{ display: "block", width: "100%", textAlign: "left", background: sel === x.id ? "rgba(79,140,255,.12)" : "none", border: "1px solid " + (sel === x.id ? "var(--line-strong)" : "transparent"), borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: "var(--text)", marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b style={{ fontSize: 13 }}>{x.topic}</b>
              <span className={"badge " + (x.status === "open" ? "badge-hot" : x.status === "answered" ? "badge-pop" : "badge-new")}>{x.status}</span>
            </div>
            <small style={{ color: "var(--muted)" }}>{x.id} · {x.name || x.email || "anonymous"} · {x.messages?.length || 1} msg</small>
          </button>
        ))}
      </Reveal>
      <Reveal className="card" delay={0.06}>
        {!t ? <div className="empty-state">Select a ticket.</div> : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div><h3 style={{ margin: 0 }}>{t.topic} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 13 }}>· {t.id}</span></h3>
                <small style={{ color: "var(--muted)" }}>{t.name || "—"} · {t.email || "no email"} · opened {new Date(t.createdAt).toLocaleString()}</small></div>
              <div style={{ display: "flex", gap: 6 }}>
                {["open", "answered", "closed"].map((s) => (
                  <button key={s} className={"chip-toggle" + (t.status === s ? " on" : "")} onClick={() => setStatus(s)}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 14 }}>
              {t.messages.map((m, i) => (
                <div key={i} className={"msg " + m.from} style={{ margin: "0 0 10px " + (m.from === "support" ? "auto" : 0), maxWidth: "85%", padding: "10px 14px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55, background: m.from === "support" ? "rgba(184,242,41,.12)" : "var(--bg-elev)", border: "1px solid var(--line)", color: "var(--text)", textAlign: "left" }}>
                  <small style={{ display: "block", color: "var(--faint)", fontSize: 10.5, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{m.from === "support" ? "Support team" : "User"} · {new Date(m.time).toLocaleString()}</small>
                  {m.text}
                </div>
              ))}
            </div>
            {t.status !== "closed" ? (
              <>
                <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as support — the user sees this in their ticket thread and receives it by branded email." />
                <button className="btn btn-primary" disabled={busy || reply.trim().length < 2} onClick={send}>{busy ? "Sending…" : "Reply & email user"}</button>
              </>
            ) : <div className="auth-error" style={{ fontSize: 13 }}>Ticket closed — reopen it to reply.</div>}
          </>
        )}
      </Reveal>
    </div>
  );
}

/* ---------- payment methods management ---------- */
const PM_ASSETS = [["bitcoin", "BTC"], ["ethereum", "ETH"], ["tether", "USDT"], ["tron", "TRX"], ["solana", "SOL"], ["binancecoin", "BNB"], ["ripple", "XRP"], ["dogecoin", "DOGE"], ["cardano", "ADA"], ["EUR", "EUR"], ["USD", "USD"], ["GBP", "GBP"], ["NGN", "NGN"]];
const EMPTY_PM = { kind: "crypto", asset: "bitcoin", symbol: "BTC", network: "Bitcoin", address: "", bankName: "", accountName: "", accountNumber: "", note: "", enabled: true };

function PaymentMethods() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null); // "new" | method id | null
  const [form, setForm] = useState(EMPTY_PM);
  const startNew = () => { if (edit) { setEdit(null); return; } setForm(EMPTY_PM); setEdit("new"); };
  const startEditM = (m) => { setForm({ ...EMPTY_PM, ...m }); setEdit(m.id); };
  const load = () => api.adminPaymentMethods().then((r) => setList(r.paymentMethods || [])).catch(() => { });
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = edit === "new" ? await api.adminAddPaymentMethod(form) : await api.adminUpdatePaymentMethod(edit, form);
      setList(r.paymentMethods); setEdit(null);
    } catch (err) { alert(err.message); }
  };
  const toggle = async (m) => { try { const r = await api.adminUpdatePaymentMethod(m.id, { enabled: !m.enabled }); setList(r.paymentMethods); } catch (e) { alert(e.message); } };
  const del = async (m) => { if (!confirm(`Delete ${m.symbol} · ${m.network}?`)) return; try { const r = await api.adminDeletePaymentMethod(m.id); setList(r.paymentMethods); } catch (e) { alert(e.message); } };
  const inp = { width: "100%", padding: "9px 11px", fontSize: 13, borderRadius: 9, border: "1px solid var(--line)", background: "var(--bg-elev)", color: "var(--text)" };

  return (
    <div className="card" style={{ padding: 18, marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 2 }}>💳 Payment methods</h3>
          <p style={{ color: "var(--muted)", fontSize: 12.5 }}>Receiving wallets shown to users on the Funding page. Only enabled methods are public. Deposits and withdrawals are crypto-only by design.</p>
        </div>
        <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={startNew}>{edit ? "Close" : "＋ Add method"}</button>
      </div>

      {edit && (
        <form onSubmit={submit} style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[["crypto", "🪙 Crypto wallet"], ["bank", "🏦 Bank transfer"]].map(([k, l]) => (
              <button key={k} type="button" className={"chip-toggle" + (form.kind === k ? " active" : "")} onClick={() => setForm((f) => ({ ...f, kind: k }))}>{l}</button>
            ))}
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Asset
              <select style={{ ...inp, marginTop: 4 }} value={form.asset} onChange={(e) => {
                const a = e.target.value; const sym = PM_ASSETS.find(([k]) => k === a)?.[1] || a;
                setForm((f) => ({ ...f, asset: a, symbol: sym }));
              }}>
                {PM_ASSETS.map(([k, s]) => <option key={k} value={k}>{s} — {k}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{form.kind === "bank" ? "Short label (shown on the funding card)" : "Network label"}
              <input style={{ ...inp, marginTop: 4 }} required={form.kind === "crypto"} value={form.network} onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))} placeholder={form.kind === "bank" ? "e.g. Bank transfer · Nigeria" : "e.g. Tron (TRC-20)"} />
            </label>
          </div>
          {form.kind === "crypto" ? (
            <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginTop: 12 }}>Receiving wallet address
              <input style={{ ...inp, marginTop: 4, fontFamily: "monospace" }} required minLength={10} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="bc1q… / 0x… / T… / r…" />
            </label>
          ) : (
            <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Bank name<input style={{ ...inp, marginTop: 4 }} required value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Account name<input style={{ ...inp, marginTop: 4 }} required value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Account number<input style={{ ...inp, marginTop: 4 }} required value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} /></label>
            </div>
          )}
          <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginTop: 12 }}>Note to users (optional)
            <input style={{ ...inp, marginTop: 4 }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Send USDT on Tron (TRC-20) only." />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            <label style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled (visible to users)
            </label>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: 13 }} type="submit">{edit === "new" ? "Add method" : "Save changes"}</button>
          </div>
        </form>
      )}

      {!list ? <div className="spinner" style={{ margin: "16px auto" }} /> : list.length === 0 && !edit ? (
        <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 12 }}>No payment methods yet — users see an honest “being set up” notice on the Funding page until you add one.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="data" style={{ minWidth: 640 }}>
            <thead><tr><th>Asset</th><th>Network</th><th>Address / account</th><th>Status</th><th className="num">Actions</th></tr></thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.symbol}</b><br /><small style={{ color: "var(--muted)" }}>{m.asset}</small></td>
                  <td>{m.network}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11.5, wordBreak: "break-all", maxWidth: 260 }}>{m.kind === "crypto" ? m.address : `${m.bankName} · ${m.accountName} · ${m.accountNumber}`}</td>
                  <td><span className={"badge " + (m.enabled ? "badge-pop" : "badge-hot")}>{m.enabled ? "enabled" : "hidden"}</span></td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <button className="cancel-btn" style={{ color: "var(--accent)", marginRight: 8 }} onClick={() => startEditM(m)}>{edit === m.id ? "editing…" : "Edit"}</button>
                    <button className="cancel-btn" style={{ color: "var(--accent-2)", marginRight: 8 }} onClick={() => toggle(m)}>{m.enabled ? "Disable" : "Enable"}</button>
                    <button className="cancel-btn" style={{ color: "var(--down)" }} onClick={() => del(m)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- funding verification (manual payment review) ---------- */
function FundingAdmin() {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(null);
  const load = () => api.adminFunding(filter === "all" ? "" : filter).then((r) => setList(r.requests || [])).catch(() => { });
  useEffect(() => { setList(null); load(); }, [filter]);
  const decide = async (r, action) => {
    const reason = (reasons[r.id] || "").trim();
    if (action === "reject" && !reason) { alert("Enter a rejection reason first — the user sees it in their history and email."); return; }
    setBusy(r.id);
    try { await api.adminFundingDecide(r.id, action, reason); load(); } catch (e) { alert(e.message); } finally { setBusy(null); }
  };
  return (
    <Reveal>
      <PaymentMethods />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["pending", "⏳ Pending"], ["approved", "✓ Approved"], ["rejected", "✕ Rejected"], ["all", "All"]].map(([k, l]) => (
          <button key={k} className={"chip-toggle" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
        Payment verification is manual: confirm each transfer in your wallets before approving. Approving a deposit credits the user's live wallet on their next funding-page load (with notification + email); rejecting a withdrawal refunds their held funds automatically. For withdrawals, send the payout to the shown address first, then approve to mark it paid.
      </p>
      {!list ? <div className="spinner" /> : (
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 900 }}>
            <thead><tr><th>Request</th><th>User</th><th>Type</th><th>Asset</th><th className="num">Amount</th><th>Payment detail</th><th>Submitted</th><th>Status</th><th className="num">Decision</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No {filter === "all" ? "" : filter + " "}funding requests.</td></tr>}
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="tnum"><b>{r.id}</b></td>
                  <td><b>{r.name}</b><br /><small style={{ color: "var(--muted)" }}>{r.email}</small></td>
                  <td><span className={"badge " + (r.type === "deposit" ? "badge-pop" : "badge-hot")}>{r.type === "deposit" ? "↓ deposit" : "↑ withdraw"}</span></td>
                  <td><b>{r.assetLabel || r.asset}</b></td>
                  <td className="num tnum">{Number(r.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 10.5, wordBreak: "break-all", maxWidth: 180, color: "var(--muted)" }}>
                    {r.type === "deposit"
                      ? (r.txRef ? <>tx: {r.txRef}</> : <i>no tx ref given</i>)
                      : (<>→ {r.destAddress}<br />{r.network}</>)}
                  </td>
                  <td className="tnum" style={{ fontSize: 12.5 }}>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={"badge " + (r.status === "approved" ? "badge-pop" : r.status === "rejected" ? "badge-hot" : "badge-new")}>{r.status}</span>
                    {r.status !== "pending" && <><br /><small style={{ color: "var(--muted)" }}>{r.decidedBy} · {new Date(r.decidedAt).toLocaleDateString()}</small>{r.reason && <><br /><small style={{ color: "var(--down)" }}>{r.reason}</small></>}</>}
                  </td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    {r.status === "pending" ? (
                      <>
                        <button className="cancel-btn" style={{ color: "var(--accent)", marginRight: 8 }} disabled={busy === r.id} onClick={() => decide(r, "approve")}>✓ Approve</button>
                        <input value={reasons[r.id] || ""} onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))} placeholder="Rejection reason…"
                          style={{ width: 150, padding: "6px 9px", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-elev)", color: "var(--text)", marginRight: 8 }} />
                        <button className="cancel-btn" style={{ color: "var(--down)" }} disabled={busy === r.id} onClick={() => decide(r, "reject")}>✕ Reject</button>
                      </>
                    ) : <span style={{ color: "var(--faint)", fontSize: 12 }}>decided</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Reveal>
  );
}

function Users() {
  const { user: me } = useApp();
  const [users, setUsers] = useState(null);
  const load = () => api.adminUsers().then((r) => setUsers(r.users)).catch(() => { });
  useEffect(() => { load(); }, []);
  const act = async (u, fn) => { try { await fn(); load(); } catch (e) { alert(e.message); } };
  if (!users) return <div className="spinner" />;
  return (
    <Reveal className="table-wrap">
      <table className="data" style={{ minWidth: 860 }}>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>KYC</th><th>2FA</th><th>Status</th><th>Joined</th><th className="num">Actions</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.id === me.id && <span className="badge badge-pop" style={{ marginLeft: 6 }}>you</span>}</td><td>{u.email}</td>
              <td>{u.role === "admin" ? <span className="badge badge-hot">admin</span> : <span className="badge badge-new">user</span>}</td>
              <td className={u.kyc === "verified" ? "up" : u.kyc === "rejected" ? "down" : ""}>{u.kyc}</td>
              <td className={u.twoFA ? "up" : ""}>{u.twoFA ? "on" : "off"}</td>
              <td className={u.suspended ? "down" : "up"}><b>{u.suspended ? "suspended" : "active"}</b></td>
              <td className="tnum">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="num" style={{ whiteSpace: "nowrap" }}>
                {u.id !== me.id && (
                  <>
                    <button className="cancel-btn" style={{ marginRight: 6, color: u.suspended ? "var(--accent)" : "var(--down)" }}
                      onClick={() => act(u, () => api.adminSuspend(u.id, !u.suspended))}>
                      {u.suspended ? "Reinstate" : "Suspend"}
                    </button>
                    <button className="cancel-btn" style={{ color: "var(--accent-2)" }}
                      onClick={() => act(u, () => api.adminSetRole(u.id, u.role === "admin" ? "user" : "admin"))}>
                      {u.role === "admin" ? "Demote" : "Make admin"}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  );
}

function Announce() {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.config().then((r) => { setCfg(r.config.announcement); setForm({ ...r.config.announcement }); }).catch(() => { }); }, []);
  if (!form) return <div className="spinner" />;
  const save = async () => {
    setMsg(null);
    try { const r = await api.adminConfig(form); setCfg(r.config.announcement); setMsg({ ok: true, text: "Announcement updated site-wide." }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <Reveal className="card">
        <h3>Announcement bar</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Controls the bar at the very top of every page for all visitors.</p>
        <label className="consent" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={form.enabled !== false} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Announcement bar visible
        </label>
        <div className="field"><label>Message</label><textarea rows={3} maxLength={220} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field"><label>Link path</label><input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/strategies" /></div>
          <div className="field"><label>Link label</label><input value={form.linkLabel} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} /></div>
        </div>
        {msg && <div className={msg.ok ? "auth-ok" : "auth-error"} style={{ fontSize: 13 }}>{msg.text}</div>}
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save}>Publish announcement</button>
      </Reveal>
      <Reveal className="card" delay={0.07}>
        <h3 style={{ marginBottom: 12 }}>Live preview</h3>
        {form.enabled === false ? <div className="empty-state">Bar is hidden site-wide.</div> : (
          <div className="announce" style={{ position: "relative", borderRadius: 10 }}>
            <span>{form.text}{form.link && form.linkLabel && <> · <a href={form.link} onClick={(e) => e.preventDefault()} style={{ color: "var(--accent)" }}>{form.linkLabel}</a>}</>}</span>
          </div>
        )}
        <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 14 }}>Current live config: {cfg ? (cfg.enabled === false ? "hidden" : "visible") : "…"} · visitors can dismiss per session.</p>
      </Reveal>
    </div>
  );
}

function Outbox() {
  const [data, setData] = useState(null);
  const load = () => api.adminOutbox().then(setData).catch(() => { });
  useEffect(() => { load(); }, []);
  const resend = async (id) => { try { await api.adminResendEmail(id); load(); } catch (e) { alert(e.message); } };
  if (!data) return <div className="spinner" />;
  return (
    <>
      <div className={"auth-" + (data.emailEnabled ? "ok" : "error")} style={{ marginBottom: 18, fontSize: 13.5 }}>
        {data.emailEnabled ? "✓ SMTP configured — emails deliver in real time." : "⚠ SMTP not configured: emails stay queued honestly. Resend re-queues them (and will deliver once SMTP is connected)."}
      </div>
      <Reveal className="table-wrap">
        <table className="data" style={{ minWidth: 760 }}>
          <thead><tr><th>Time</th><th>To</th><th>Subject</th><th>Status</th><th className="num">Action</th></tr></thead>
          <tbody>
            {data.outbox.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)", textAlign: "center", padding: 26 }}>Outbox empty.</td></tr>}
            {data.outbox.map((o) => (
              <tr key={o.id}>
                <td className="tnum">{new Date(o.time).toLocaleString()}</td>
                <td>{o.to}</td>
                <td>{o.subject}</td>
                <td className={o.status === "sent" ? "up" : o.status === "failed" ? "down" : ""} style={{ color: o.status === "queued" ? "var(--gold)" : undefined }}>
                  <b>{o.status}</b>{o.error ? ` — ${o.error}` : ""}
                </td>
                <td className="num"><button className="cancel-btn" style={{ color: "var(--accent-2)" }} onClick={() => resend(o.id)}>Resend</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </>
  );
}

export default function Admin() {
  const { user, authLoading } = useApp();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  useEffect(() => { if (user?.role === "admin") api.adminStats().then(setStats).catch(() => { }); }, [user?.role]);

  if (authLoading) return <Section><div className="container"><div className="spinner" /></div></Section>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") {
    /* stealth: non-admins see a generic 404 — the admin area is not discoverable */
    return (
      <Section><div className="container" style={{ textAlign: "center", padding: "120px 20px" }}>
        <div className="grad-text" style={{ fontSize: 84, fontWeight: 900, lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: 28, margin: "14px 0 8px" }}>Page not found</h1>
        <p style={{ color: "var(--muted)", marginBottom: 26 }}>The page you're looking for doesn't exist or has moved.</p>
        <Link className="btn btn-primary btn-lg" to="/">Back to home</Link>
      </div></Section>
    );
  }
  return (
    <Section>
      <div className="container">
        <div className="dash-head">
          <div>
            <div className="kicker">Administration</div>
            <h1 style={{ fontSize: "clamp(26px,4vw,38px)" }}>Admin dashboard 🛠</h1>
            <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 14 }}>Support conversations, branded email campaigns and platform stats.</p>
          </div>
          <Link className="btn btn-ghost" to="/dashboard">User dashboard →</Link>
        </div>
        <div className="dash-tabs">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === "overview" && <Overview stats={stats} />}
        {tab === "composer" && <Composer />}
        {tab === "tickets" && <Tickets />}
        {tab === "funding" && <FundingAdmin />}
        {tab === "users" && <Users />}
        {tab === "announce" && <Announce />}
        {tab === "outbox" && <Outbox />}
      </div>
    </Section>
  );
}
