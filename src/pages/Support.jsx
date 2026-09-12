import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Reveal, Section, SectionHead, PageHero } from "../components/ui.jsx";
import { api } from "../services/api.js";
import { useApp } from "../app-context.jsx";

const FAQ = [
  ["Is this real trading?", "No — and that's the point. Vertex Trader is a paper-trading platform: you trade with virtual funds against live CoinGecko market data. You can't deposit, withdraw or lose real money."],
  ["Where do the prices come from?", "All quotes, candles and coin statistics are fetched live from CoinGecko's public API. Prices update every 15–20 seconds; during API rate limits the app serves cached data and labels it clearly."],
  ["Why is my chart not updating tick-by-tick?", "The free CoinGecko API polls rather than streams. Between polls the chart holds the last real price — there is no simulated tick generator, because fabricating prices would defeat the purpose of practising on real data."],
  ["What happens when a position gets liquidated?", "Exactly what happens on a real exchange: when the live mark price reaches your liquidation level (computed from entry, leverage and 0.5% maintenance margin), the position closes and the isolated margin is lost. It's logged in your history."],
  ["Do I need an account?", "You can use the terminal as a guest — your wallet is stored on this device. An account keeps everything server-side, adds KYC, 2FA, login history and cross-session tracking."],
  ["Is my KYC reviewed by a person?", "No. Verification is automated rule-based validation: your details are checked for completeness and consistency, your date of birth is checked against the minimum age, and uploaded documents are validated. If validation fails you receive the specific reasons and can resubmit."],
  ["How do I enable 2FA?", "Dashboard → Security → Two-factor authentication. You'll get a setup secret for any authenticator app (Google Authenticator, Authy, 1Password). Codes are standard 6-digit TOTP, verified server-side."],
  ["My data disappeared — what happened?", "Guest wallets live in your browser's localStorage; clearing site data removes them. Logged-in accounts persist server-side. The 'Reset wallet' button in the terminal also clears everything intentionally."],
];

const TOPICS = ["Trading terminal", "Account & security", "KYC verification", "Market data", "Bug report", "Other"];

export default function Support() {
  const { user } = useApp();
  const [form, setForm] = useState({ topic: "", message: "", name: "", email: "" });
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const refreshTickets = () => api.myTickets().then((r) => setTickets(r.tickets || [])).catch(() => { });
  useEffect(() => { if (user) refreshTickets(); else setTickets([]); }, [user?.id]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await api.support({ topic: form.topic, message: form.message, name: form.name || undefined, email: form.email || undefined });
      setSent(r); setForm({ topic: "", message: "", name: "", email: "" });
      if (user) refreshTickets();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    setReplyBusy(true);
    try {
      const r = await api.replyTicket(sel, reply);
      setTickets((cur) => cur.map((t) => (t.id === sel ? r.ticket : t)));
      setReply("");
    } catch (e2) { setErr(e2.message); } finally { setReplyBusy(false); }
  };

  const t = tickets.find((x) => x.id === sel);

  return (
    <>
      <PageHero crumb="Support" title="Help & support" text="Answers to the questions that matter most, plus a real ticket system that reaches us." />

      <Section>
        <div className="container">
          <SectionHead kicker="FAQ" title="Frequently asked" text="Click a question to expand." />
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            {FAQ.map(([q, a], i) => (
              <Reveal key={q} delay={Math.min(i * 0.04, 0.2)}>
                <div className="faq-item">
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {q}<span className="faq-plus">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && <p>{a}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section alt>
        <div className="container" style={{ maxWidth: 760 }}>
          <SectionHead kicker="Contact" title="Open a support ticket" text={user ? `Submitting as ${user.email} — tickets are linked to your account.` : "You can submit without an account; log in to track ticket status."} />
          <Reveal className="form-card" style={{ maxWidth: 640, margin: "0 auto" }}>
            {sent ? (
              <div className="auth-ok" style={{ fontSize: 15 }}>
                ✓ Ticket <b>{sent.id}</b> opened — it's now a live conversation thread.
                {user ? " Reply to it below any time; our support team answers in-thread and by email." : " Log in with your account to continue the conversation in-thread."}
                <button className="btn btn-ghost" style={{ marginTop: 14, display: "block", width: "100%" }} onClick={() => { setSent(null); if (user) { setSel(sent.id); refreshTickets(); } }}>
                  {user ? "Open the conversation →" : "Submit another"}
                </button>
              </div>
            ) : (
              <>
                {err && <div className="auth-error">{err}</div>}
                <form onSubmit={submit}>
                  <div className="field"><label>Topic</label>
                    <select required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                      <option value="">Choose a topic…</option>
                      {TOPICS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {!user && (
                    <div className="grid-2" style={{ gap: 14 }}>
                      <div className="field"><label>Your name</label><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></div>
                      <div className="field"><label>Your email (for our reply)</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
                    </div>
                  )}
                  <div className="field"><label>Message</label><textarea required rows={6} minLength={10} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Describe the issue — what you did, what happened, what you expected." /></div>
                  <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? "Submitting…" : "Submit ticket"}</button>
                </form>
              </>
            )}
          </Reveal>

          {user && tickets.length > 0 && (
            <Reveal style={{ marginTop: 40 }}>
              <h3 style={{ marginBottom: 6 }}>Your support conversations</h3>
              <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 16 }}>Every ticket is an open thread — pick one to read the full exchange and reply. Support answers appear here and arrive by email.</p>
              <div className="grid-2" style={{ alignItems: "start", gridTemplateColumns: "minmax(240px,340px) 1fr" }}>
                <div className="card" style={{ padding: 10, maxHeight: 480, overflowY: "auto" }}>
                  {tickets.map((x) => (
                    <button key={x.id} type="button" onClick={() => setSel(x.id)}
                      style={{ display: "block", width: "100%", textAlign: "left", background: sel === x.id ? "rgba(79,140,255,.12)" : "none", border: "1px solid " + (sel === x.id ? "var(--line-strong)" : "transparent"), borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: "var(--text)", marginBottom: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <b style={{ fontSize: 13 }}>{x.topic}</b>
                        <span className={"badge " + (x.status === "open" ? "badge-hot" : x.status === "answered" ? "badge-pop" : "badge-new")}>{x.status}</span>
                      </div>
                      <small style={{ color: "var(--muted)" }}>{x.id} · {x.messages?.length || 1} messages · {new Date(x.createdAt).toLocaleDateString()}</small>
                    </button>
                  ))}
                </div>
                <div className="card" style={{ padding: 18 }}>
                  {!t ? <div className="empty-state">Select a conversation on the left.</div> : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                        <h4 style={{ margin: 0, fontSize: 15 }}>{t.topic} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12 }}>· {t.id}</span></h4>
                        <small style={{ color: "var(--faint)" }}>opened {new Date(t.createdAt).toLocaleString()}</small>
                      </div>
                      <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 14 }}>
                        {(t.messages || []).map((m, i) => (
                          <div key={i} style={{ margin: "0 0 10px " + (m.from === "support" ? "auto" : 0), maxWidth: "88%", padding: "10px 14px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55, background: m.from === "support" ? "rgba(45,212,167,.12)" : "var(--bg-elev)", border: "1px solid var(--line)", color: "var(--text)" }}>
                            <small style={{ display: "block", color: "var(--faint)", fontSize: 10.5, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>
                              {m.from === "support" ? " Support team" : "🙋 You"} · {new Date(m.time).toLocaleString()}
                            </small>
                            {m.text}
                          </div>
                        ))}
                      </div>
                      {t.status === "closed" ? (
                        <div className="auth-error" style={{ fontSize: 13 }}>This ticket is closed. Need more help? Open a new one above.</div>
                      ) : (
                        <form onSubmit={sendReply}>
                          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply to the support team…" />
                          <button className="btn btn-primary" disabled={replyBusy || reply.trim().length < 2} type="submit">{replyBusy ? "Sending…" : "Send reply"}</button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Reveal>
          )}
          {!user && (
            <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 13, marginTop: 26 }}>
              Want an ongoing conversation instead of a one-way ticket? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>Log in</Link> — tickets become reply-able threads tied to your account.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
