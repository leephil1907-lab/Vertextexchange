import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { createChart, ColorType } from "lightweight-charts";
import { Reveal, Section } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { api } from "../services/api.js";
import { paper } from "../engine/paper.js";
import { priceStore, getMarkets, CURRENCIES, fmtMoney } from "../services/coingecko.js";

const TABS = [
  ["overview", "📊 Overview"],
  ["portfolio", "💼 Portfolio"],
  ["notifications", "🔔 Notifications"],
  ["kyc", "🪪 KYC"],
  ["security", "🔒 Security"],
  ["settings", "⚙️ Settings"],
];

function PnlChart({ points, up }) {
  const ref = useRef(null);
  const chart = useRef(null);
  const series = useRef(null);
  useEffect(() => {
    if (!ref.current || !points.length) return;
    const c = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a0b5", fontSize: 11 },
      grid: { vertLines: { color: "rgba(140,160,200,.06)" }, horzLines: { color: "rgba(140,160,200,.06)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    const s = c.addAreaSeries({
      lineColor: up ? "#0ca678" : "#e5484d", lineWidth: 2,
      topColor: up ? "rgba(12,166,120,.22)" : "rgba(229,72,77,.22)", bottomColor: "rgba(12,166,120,0)",
    });
    s.setData(points);
    chart.current = c; series.current = s;
    return () => c.remove();
  }, []);
  useEffect(() => {
    if (series.current && points.length) {
      series.current.setData(points);
      series.current.applyOptions({ lineColor: up ? "#0ca678" : "#e5484d", topColor: up ? "rgba(12,166,120,.22)" : "rgba(229,72,77,.22)" });
    }
  }, [points, up]);
  return <div ref={ref} style={{ height: 300, width: "100%" }} />;
}

/* ---------------- tabs ---------------- */

function Overview() {
  const { user, fiat, theme } = useApp();
  const [, force] = useState(0);
  useEffect(() => paper.subscribe(() => force((v) => v + 1)), []);
  const st = paper.state;
  if (!st) return null;
  const eq = paper.equity();
  const pts = st.equityHistory.map((p) => ({ time: Math.floor(p.t / 1000), value: p.eq }));
  const start = st.equityHistory[0]?.eq ?? eq;
  const pnl = eq - start;
  const realized = st.history.reduce((s, h) => s + (h.pnl ?? 0) + (h.loss ?? 0), 0);
  const best = [...st.history].filter((h) => h.pnl != null).sort((a, b) => b.pnl - a.pnl)[0];
  const worst = [...st.history].filter((h) => h.pnl != null).sort((a, b) => a.pnl - b.pnl)[0];

  return (
    <>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 26 }}>
        {[
          ["Total equity", fmtMoney(eq, fiat), ""],
          ["Total P&L", `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl, fiat)}`, pnl >= 0 ? "up" : "down"],
          ["Realised P&L", `${realized >= 0 ? "+" : ""}${fmtMoney(realized, fiat)}`, realized >= 0 ? "up" : "down"],
          ["Positions open", String(st.positions.length), ""],
        ].map(([l, v, cls]) => (
          <div key={l} className="stat-card">
            <div className="s-label">{l}</div>
            <div className={"s-value tnum " + cls}>{v}</div>
          </div>
        ))}
      </div>

      <Reveal className="card" style={{ padding: "22px 26px", marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Equity curve ({fiat})</h3>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Snapshots every ≤60s while the terminal is open · {pts.length} points</span>
        </div>
        {pts.length > 1
          ? <PnlChart points={pts} up={pnl >= 0} />
          : <div className="empty-state">Your equity curve builds automatically as you trade. Open the terminal and place a few orders — snapshots start appearing within a minute.</div>}
      </Reveal>

      <div className="grid-2">
        <Reveal className="card">
          <h3>Performance log</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
            <div className="stat-card"><div className="s-label">Best trade</div><div className="s-value tnum up" style={{ fontSize: 19 }}>{best ? `+${best.pnl.toFixed(2)} ${fiat}` : "—"}</div>{best && <small style={{ color: "var(--muted)" }}>{best.kind} {paper.meta(best.coinId || "").symbol}</small>}</div>
            <div className="stat-card"><div className="s-label">Worst trade</div><div className="s-value tnum down" style={{ fontSize: 19 }}>{worst ? `${worst.pnl.toFixed(2)} ${fiat}` : "—"}</div>{worst && <small style={{ color: "var(--muted)" }}>{worst.kind} {paper.meta(worst.coinId || "").symbol}</small>}</div>
            <div className="stat-card"><div className="s-label">Total executions</div><div className="s-value tnum" style={{ fontSize: 19 }}>{st.history.length}</div></div>
            <div className="stat-card"><div className="s-label">Liquidations</div><div className="s-value tnum down" style={{ fontSize: 19 }}>{st.history.filter((h) => h.kind === "liquidation").length}</div></div>
          </div>
        </Reveal>
        <Reveal className="card" delay={0.07}>
          <h3>Account status</h3>
          <div className="kyc-grid" style={{ marginTop: 14 }}>
            <div className="kyc-box">
              <div className="kyc-step done" style={{ width: 36, height: 36 }}>✓</div>
              <div><b>Logged in</b><p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>{user.email}</p></div>
            </div>
            <div className="kyc-box">
              <div className={"kyc-step " + (user.kyc?.status === "verified" ? "done" : "")} style={{ width: 36, height: 36 }}>{user.kyc?.status === "verified" ? "✓" : "!"}</div>
              <div><b>KYC: {user.kyc?.status || "not started"}</b>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>{user.kyc?.status === "verified" ? "Account fully verified." : "Complete verification in the KYC tab."}</p></div>
            </div>
            <div className="kyc-box">
              <div className={"kyc-step " + (user.security?.twoFA ? "done" : "")} style={{ width: 36, height: 36 }}>{user.security?.twoFA ? "✓" : "!"}</div>
              <div><b>2FA: {user.security?.twoFA ? "enabled" : "disabled"}</b>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>{user.security?.twoFA ? "TOTP authenticator active." : "Strongly recommended — enable in Security."}</p></div>
            </div>
            <div className="kyc-box">
              <div className="kyc-step done" style={{ width: 36, height: 36 }}>€</div>
              <div><b>Currency: {fiat}</b><p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>Change in Settings.</p></div>
            </div>
          </div>
        </Reveal>
      </div>
    </>
  );
}

function Portfolio() {
  const { fiat } = useApp();
  const [, force] = useState(0);
  useEffect(() => paper.subscribe(() => force((v) => v + 1)), []);
  const st = paper.state;
  const rows = st ? Object.entries(st.balances.coins).filter(([, q]) => q > 0) : [];

  useEffect(() => {
    if (rows.length) {
      getMarkets(CURRENCIES[fiat].vs, 1, 100).then((r) => {
        if (Array.isArray(r.data)) paper.setCoinMeta(r.data);
      }).catch(() => { });
      priceStore.configure(rows.map(([id]) => id), CURRENCIES[fiat].vs, 20000);
    }
  }, [rows.length, fiat]);

  if (!st) return null;
  const total = paper.equity();

  return (
    <>
      <Reveal className="table-wrap">
        <table className="data" style={{ minWidth: 640 }}>
          <thead><tr><th>Asset</th><th className="num">Holdings</th><th className="num">Live price</th><th className="num">Value ({fiat})</th><th className="num">Allocation</th><th className="num"></th></tr></thead>
          <tbody>
            <tr>
              <td><b>{fiat} cash</b></td>
              <td className="num tnum">{st.balances.fiat[fiat]?.toFixed(2) ?? "0.00"}</td>
              <td className="num">—</td>
              <td className="num tnum">{(st.balances.fiat[fiat] || 0).toFixed(2)}</td>
              <td className="num tnum">{total > 0 ? (((st.balances.fiat[fiat] || 0) / total) * 100).toFixed(1) + "%" : "—"}</td>
              <td className="num"><Link className="more" to="/trade">Trade →</Link></td>
            </tr>
            {rows.map(([id, q]) => {
              const px = priceStore.price(id);
              const v = (px || 0) * q;
              const m = paper.meta(id);
              return (
                <tr key={id}>
                  <td className="coin-id">{m.image && <img src={m.image} alt="" style={{ width: 22, height: 22 }} />}<b>{m.symbol}</b> <span style={{ color: "var(--muted)", fontWeight: 400 }}>{m.name || id}</span></td>
                  <td className="num tnum">{q.toPrecision(6)}</td>
                  <td className="num tnum">{px ? fmtMoney(px, fiat) : "—"}</td>
                  <td className="num tnum">{v.toFixed(2)}</td>
                  <td className="num tnum">{total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="num"><Link className="more" to={`/coin/${id}`}>Analyze →</Link></td>
                </tr>
              );
            })}
            {st.positions.map((p) => (
              <tr key={p.id} className="pos-row">
                <td><b>{paper.meta(p.coinId).symbol} {p.side} {p.leverage}x</b> <span className="badge badge-new">futures</span></td>
                <td className="num tnum">{p.qty.toPrecision(5)}</td>
                <td className="num tnum">{priceStore.price(p.coinId) ? fmtMoney(priceStore.price(p.coinId), p.fiat) : "—"}</td>
                <td className="num tnum">{(p.margin + paper.uPnl(p)).toFixed(2)}</td>
                <td className="num tnum">{total > 0 ? (((p.margin + paper.uPnl(p)) / total) * 100).toFixed(1) + "%" : "—"}</td>
                <td className="num"><Link className="more" to="/trade?tab=futures">Manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      {!rows.length && !st.positions.length && (
        <div className="empty-state">No holdings yet — your {fmtMoney(st.balances.fiat[fiat] || 0, fiat)} cash is ready. <Link to="/trade" style={{ color: "var(--accent)", fontWeight: 700 }}>Open the terminal →</Link></div>
      )}
    </>
  );
}

function Kyc() {
  const { user, refreshUser } = useApp();
  const kyc = user.kyc || {};
  const [step, setStep] = useState(1);
  const [d, setD] = useState({ fullName: "", dob: "", country: "", address: "", idType: "passport", idNumber: "", docs: [] });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const COUNTRIES = ["Germany", "France", "Spain", "Italy", "Netherlands", "Portugal", "Ireland", "Austria", "Belgium", "Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States", "Other"];
  const IDTYPES = [["passport", "🛂 Passport"], ["national_id", "🪪 National ID"], ["drivers_license", "🚗 Driver's licence"]];

  // prefill any previously stored details
  useEffect(() => {
    api.getKyc().then(({ stored }) => {
      if (stored) setD((s) => ({ ...s, ...stored, docs: s.docs }));
    }).catch(() => { });
  }, []);

  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const addFiles = (files) => {
    if (!files.length) return;
    files.forEach((f) => {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { setRes({ status: "rejected", reasons: [`"${f.name}" must be a PNG/JPG/WebP image.`] }); return; }
      const r = new FileReader();
      r.onload = () => setD((s) => ({ ...s, docs: [...s.docs, { name: f.name, dataUrl: r.result }] }));
      r.readAsDataURL(f);
    });
  };
  const onFiles = (e) => { addFiles([...(e.target.files || [])]); e.target.value = ""; };

  const submit = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await api.submitKyc({
        fullName: d.fullName, dob: d.dob, country: d.country, address: d.address,
        idType: d.idType, idNumber: d.idNumber,
        documents: d.docs.map(({ name, dataUrl }) => ({ name, dataUrl })),
      });
      setRes({ status: "verified", reviewedAt: r.reviewedAt });
      refreshUser();
    } catch (e) {
      setRes({ status: "rejected", reasons: e.data?.reasons || [e.message] });
    } finally { setBusy(false); }
  };

  const verified = res?.status === "verified" || (kyc.status === "verified" && !res);
  if (verified) {
    return (
      <Reveal className="auth-ok" style={{ fontSize: 15 }}>
        ✓ Your account is <b>KYC verified</b> — validated on {new Date(res?.reviewedAt || kyc.reviewedAt || Date.now()).toLocaleString()}. All platform features are unlocked.
      </Reveal>
    );
  }

  return (
    <Reveal>
      <div className="kyc-steps">
        {[["1", "Identity"], ["2", "Document"], ["3", "Validation"]].map(([n, l], i) => (
          <div key={n} className={"kyc-step" + (step > i + 1 ? " done" : step === i + 1 ? " active" : "")}>
            <span>{step > i + 1 ? "✓" : n}</span><small>{l}</small>
          </div>
        ))}
      </div>

      {kyc.status === "rejected" && !res && (
        <div className="auth-error" style={{ marginTop: 22 }}>
          <b>Your last submission was rejected:</b>
          <ul style={{ margin: "8px 0 0 18px" }}>{(kyc.reasons || []).map((e) => <li key={e}>{e}</li>)}</ul>
          <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>Your saved details are prefilled below — correct them and resubmit.</p>
        </div>
      )}
      {res?.status === "rejected" && (
        <div className="auth-error" style={{ marginTop: 22 }}>
          <b>Validation failed:</b>
          <ul style={{ margin: "8px 0 0 18px" }}>{(res.reasons || []).map((e) => <li key={e}>{e}</li>)}</ul>
          <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>Correct the issues above and resubmit — there's no limit on attempts.</p>
        </div>
      )}

      <div style={{ maxWidth: 560, margin: "26px auto 0" }}>
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); setRes(null); }}>
            <div className="field"><label>Full legal name</label><input required minLength={4} value={d.fullName} onChange={(e) => setD({ ...d, fullName: e.target.value })} placeholder="First and last name, as on your ID" /></div>
            <div className="field"><label>Date of birth</label><input required type="date" max={new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10)} value={d.dob} onChange={(e) => setD({ ...d, dob: e.target.value })} /></div>
            <div className="field"><label>Country of residence</label>
              <select required value={d.country} onChange={(e) => setD({ ...d, country: e.target.value })}>
                <option value="">Select…</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Residential address</label><textarea required rows={3} minLength={8} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} placeholder="Street, number, postal code, city" /></div>
            <p style={{ color: "var(--faint)", fontSize: 12.5, marginBottom: 16 }}>Minimum age is 18. Validation is automated — data is checked for completeness and consistency, stored against your account, and never shared.</p>
            <button className="btn btn-primary btn-block" type="submit">Continue to document →</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
            <div className="field"><label>Document type</label>
              <div className="chip-toggle">
                {IDTYPES.map(([v, l]) => (
                  <button key={v} type="button" className={d.idType === v ? "active" : ""} onClick={() => setD({ ...d, idType: v })}>{l}</button>
                ))}
              </div>
            </div>
            <div className="field"><label>Document number</label><input required minLength={5} value={d.idNumber} onChange={(e) => setD({ ...d, idNumber: e.target.value })} placeholder="As printed on the document" /></div>
            <div className="field"><label id="kyc-upload-label">Upload photo(s) of document — PNG/JPG/WebP</label>
              <div
                className={"dropzone" + (dragOver ? " over" : "")}
                role="button" tabIndex={0} aria-labelledby="kyc-upload-label"
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles([...(e.dataTransfer.files || [])]); }}
              >
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onFiles} hidden />
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <b>{dragOver ? "Drop to attach" : "Drag & drop document photos here"}</b>
                <span>or <u>click to browse</u> · PNG / JPG / WebP · multiple files OK</span>
              </div>
            </div>
            {d.docs.length > 0 && (
              <div className="doc-thumbs">
                {d.docs.map((f, i) => (
                  <div className="doc-thumb" key={i}>
                    <img src={f.dataUrl} alt={"Preview of " + f.name} />
                    <div className="dt-meta">
                      <b>{f.name}</b>
                      <small>✓ {Math.round((f.dataUrl.length * 0.75) / 1024)} KB</small>
                    </div>
                    <button type="button" aria-label={"Remove " + f.name} onClick={() => setD({ ...d, docs: d.docs.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 2 }} type="submit">Continue to validation →</button>
            </div>
          </form>
        )}
        {step === 3 && (
          <div>
            <div className="card" style={{ marginBottom: 18, padding: "18px 22px" }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Review your submission</h3>
              {[["Name", d.fullName], ["Date of birth", d.dob], ["Country", d.country], ["Address", d.address], ["Document", (IDTYPES.find(([v]) => v === d.idType)?.[1] || d.idType) + " · " + (d.idNumber || "no number")], ["Uploads", d.docs.length ? d.docs.length + " file(s) attached ✓" : "none ⚠"]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                  <span style={{ color: "var(--muted)" }}>{l}</span><b style={{ textAlign: "right" }}>{v || "—"}</b>
                </div>
              ))}
            </div>
            <p style={{ color: "var(--faint)", fontSize: 12.5, marginBottom: 16 }}>On submit, automated validation checks completeness, age (18+) and the document uploads. You'll get an immediate result — pass or specific rejection reasons.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy || !d.docs.length} onClick={submit}>{busy ? "Validating…" : "Submit for validation"}</button>
            </div>
            {!d.docs.length && <p style={{ color: "var(--gold)", fontSize: 12.5, marginTop: 10 }}>⚠ At least one document upload is required.</p>}
          </div>
        )}
      </div>
    </Reveal>
  );
}

function Security() {
  const { user, refreshUser } = useApp();
  const [pw, setPw] = useState({ current: "", next: "", next2: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [tfaMsg, setTfaMsg] = useState(null);
  const [logins, setLogins] = useState(user.loginHistory || []);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLogins(user.loginHistory || []); }, [user]);

  const changePw = async (e) => {
    e.preventDefault(); setPwMsg(null); setBusy(true);
    try {
      if (pw.next !== pw.next2) throw new Error("New passwords do not match.");
      await api.changePassword(pw.current, pw.next);
      setPwMsg({ ok: true, text: "Password updated." });
      setPw({ current: "", next: "", next2: "" });
    } catch (e2) { setPwMsg({ ok: false, text: e2.message }); } finally { setBusy(false); }
  };
  const start2FA = async () => { setTfaMsg(null); try { const r = await api.twoFASetup(); setSetup(r); } catch (e) { setTfaMsg({ ok: false, text: e.message }); } };
  const confirm2FA = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.twoFAVerify(code); setTfaMsg({ ok: true, text: "Two-factor authentication enabled." }); setSetup(null); setCode(""); refreshUser(); }
    catch (e2) { setTfaMsg({ ok: false, text: e2.message }); } finally { setBusy(false); }
  };
  const disable2FA = async () => {
    const c = prompt("Enter a current authenticator code to disable 2FA:");
    if (!c) return;
    try { await api.twoFADisable(c); setTfaMsg({ ok: true, text: "Two-factor authentication disabled." }); refreshUser(); }
    catch (e) { setTfaMsg({ ok: false, text: e.message }); }
  };

  return (
    <div className="grid-2">
      <Reveal className="card">
        <h3>Two-factor authentication</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 16px" }}>Status: {user.security?.twoFA ? <b className="up">enabled ✓</b> : <b className="down">disabled</b>} — TOTP (RFC 6238), works with Google Authenticator, Authy, 1Password, etc.</p>
        {tfaMsg && <div className={tfaMsg.ok ? "auth-ok" : "auth-error"} style={{ marginBottom: 14 }}>{tfaMsg.text}</div>}
        {!user.security?.twoFA && !setup && <button className="btn btn-primary" onClick={start2FA}>Enable 2FA</button>}
        {setup && (
          <form onSubmit={confirm2FA}>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 10 }}>Add this account to your authenticator app using the setup key (or the otpauth URI):</p>
            <div style={{ background: "var(--bg-elev)", border: "1px dashed var(--line)", borderRadius: 10, padding: "12px 14px", fontFamily: "var(--mono, monospace)", fontSize: 15, fontWeight: 700, letterSpacing: 2, textAlign: "center", marginBottom: 8, wordBreak: "break-all" }}>{setup.secret}</div>
            <div style={{ fontSize: 11.5, color: "var(--faint)", wordBreak: "break-all", marginBottom: 14 }}>{setup.otpauth}</div>
            <div className="field"><label>Enter the 6-digit code to confirm</label>
              <input required inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" style={{ letterSpacing: 6, fontSize: 18 }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSetup(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy}>{busy ? "Verifying…" : "Verify & enable"}</button>
            </div>
          </form>
        )}
        {user.security?.twoFA && <button className="btn btn-ghost" onClick={disable2FA} style={{ color: "var(--down)" }}>Disable 2FA</button>}
      </Reveal>

      <Reveal className="card" delay={0.07}>
        <h3>Change password</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 16px" }}>Passwords are hashed with scrypt and a per-user salt. Changing your password does not log out this session.</p>
        {pwMsg && <div className={pwMsg.ok ? "auth-ok" : "auth-error"} style={{ marginBottom: 14 }}>{pwMsg.text}</div>}
        <form onSubmit={changePw}>
          <div className="field"><label>Current password</label><input required type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></div>
          <div className="field"><label>New password</label><input required type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></div>
          <div className="field"><label>Confirm new password</label><input required type="password" minLength={8} value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} autoComplete="new-password" /></div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
      </Reveal>

      <Reveal className="card" delay={0.12} style={{ gridColumn: "1 / -1" }}>
        <h3>Login history</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 14 }}>The last logins to your account. Don't recognise one? Change your password immediately.</p>
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 480 }}>
            <thead><tr><th>Time</th><th>IP</th><th>Result</th></tr></thead>
            <tbody>
              {logins.length === 0 && <tr><td colSpan={3} style={{ color: "var(--muted)" }}>No recorded logins yet.</td></tr>}
              {logins.slice(0, 10).map((l, i) => (
                <tr key={i}>
                  <td className="tnum">{new Date(l.t).toLocaleString()}</td>
                  <td className="tnum">{l.ip === "::1" || l.ip === "::ffff:127.0.0.1" ? "this device" : l.ip || "—"}</td>
                  <td className={l.ok ? "up" : "down"}><b>{l.ok ? "success" : "failed"}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}

function NotificationsTab() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.notifications().then(setData).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);

  const toggle = async (k) => {
    const next = { ...data.settings.email, [k]: !data.settings.email[k] };
    setData((d) => ({ ...d, settings: { email: next } }));
    try { const r = await api.saveNotifSettings(next); setData((d) => ({ ...d, settings: r.settings })); }
    catch (e) { setMsg({ ok: false, text: e.message }); load(); }
  };
  const test = async () => {
    setMsg(null); setBusy(true);
    try {
      const r = await api.testEmail();
      setMsg(r.emailEnabled
        ? { ok: true, text: `Test email dispatched to your address (delivery status: ${r.status}).` }
        : { ok: false, text: `Email delivery is not configured on this server (no SMTP credentials), so the test email was honestly queued with status "${r.status}". Configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to enable real delivery — settings below are stored and applied either way.` });
      load();
    } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const markAll = async () => { try { await api.markNotifRead(); load(); } catch (e) { } };

  if (!data) return <div className="spinner" />;
  const KIND_META = [
    ["security", "🛡️", "Security & account", "New logins, password and 2FA changes, KYC results."],
    ["trades", "📈", "Trades & positions", "Spot fills, futures opens/closes, liquidations, DCA buys, swaps."],
    ["alerts", "🔔", "Price alerts", "Above/below alerts you set on charts — they fire from live prices."],
    ["product", "📦", "Product & support", "Platform updates and support ticket confirmations. Off by default."],
  ];
  return (
    <>
      <div className={"auth-" + (data.emailEnabled ? "ok" : "error")} style={{ marginBottom: 20, fontSize: 13.5 }}>
        {data.emailEnabled
          ? "✓ SMTP delivery is configured on this server — enabled notifications are emailed to " + (data.items[0] ? "your address" : "your address") + "."
          : "⚠ Email delivery is not configured on this server yet (no SMTP credentials). Notification settings are saved and enforced; emails are recorded in the outbox below with status \"queued\" and will deliver once SMTP is connected. In-app notifications always work."}
      </div>

      <div className="grid-2">
        <Reveal className="card">
          <h3>Email channels</h3>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "6px 0 16px" }}>In-app notifications (bell in the header) are always on. Email follows your toggles below.</p>
          {KIND_META.map(([k, ico, title, desc]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 2px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{ico} {title}</b>
                <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "2px 0 0" }}>{desc}</p>
              </div>
              <button className={"switch" + (data.settings.email[k] ? " on" : "")} role="switch" aria-checked={!!data.settings.email[k]} aria-label={title + " email"} onClick={() => toggle(k)}>
                <span className="sw-knob" />
              </button>
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy} onClick={test}>{busy ? "Sending…" : "Send test email"}</button>
          {msg && <div className={msg.ok ? "auth-ok" : "auth-error"} style={{ marginTop: 14, fontSize: 13 }}>{msg.text}</div>}
        </Reveal>

        <Reveal className="card" delay={0.07}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Notification feed</h3>
            <button className="cancel-btn" style={{ color: "var(--accent)", borderColor: "var(--line-strong)" }} onClick={markAll}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {data.items.length === 0 && <div className="empty-state">Nothing yet — logins, trades, alerts and KYC results will appear here.</div>}
            {data.items.map((n) => (
              <div key={n.id} className={"notif" + (n.read ? "" : " unread")} style={{ marginBottom: 8 }}>
                <span className="n-ico">{({ security: "🛡️", trades: "📈", alerts: "🔔", product: "📦" })[n.kind] || "•"}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  <small>{new Date(n.time).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="card" delay={0.12} style={{ gridColumn: "1 / -1" }}>
          <h3>Email outbox</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 14px" }}>Every email this platform generated for you, with its true delivery status — no fabricated "sent" labels.</p>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 620 }}>
              <thead><tr><th>Time</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {data.outbox.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No emails generated yet.</td></tr>}
                {data.outbox.map((o) => (
                  <tr key={o.id}>
                    <td className="tnum">{new Date(o.time).toLocaleString()}</td>
                    <td>{o.to}</td>
                    <td>{o.subject}</td>
                    <td className={o.status === "sent" ? "up" : o.status === "failed" ? "down" : ""} style={{ color: o.status === "queued" ? "var(--gold)" : undefined }}>
                      <b>{o.status}</b>{o.error ? ` — ${o.error}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </>
  );
}

function Settings() {
  const { user, fiat, setFiat, theme, toggleTheme, logout, refreshUser } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(user.name || "");
  const [msg, setMsg] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await api.updateMe({ name }); setMsg({ ok: true, text: "Profile updated." }); refreshUser(); }
    catch (e2) { setMsg({ ok: false, text: e2.message }); }
  };
  return (
    <div className="grid-2">
      <Reveal className="card">
        <h3>Profile</h3>
        {msg && <div className={msg.ok ? "auth-ok" : "auth-error"} style={{ margin: "12px 0" }}>{msg.text}</div>}
        <form onSubmit={save} style={{ marginTop: 14 }}>
          <div className="field"><label>Display name</label><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Email (login credential — fixed)</label><input disabled value={user.email} /></div>
          <button className="btn btn-primary" type="submit">Save profile</button>
        </form>
      </Reveal>
      <Reveal className="card" delay={0.07}>
        <h3>Preferences</h3>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginBottom: 6 }}>Display currency</label>
          <div className="chip-toggle" style={{ marginBottom: 18 }}>
            {Object.keys(CURRENCIES).map((c) => <button key={c} type="button" className={fiat === c ? "active" : ""} onClick={() => setFiat(c)}>{c} {c === "EUR" && "(default)"}</button>)}
          </div>
          <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginBottom: 6 }}>Theme</label>
          <div className="chip-toggle" style={{ marginBottom: 18 }}>
            <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => theme !== "dark" && toggleTheme()}>🌙 Dark</button>
            <button type="button" className={theme === "light" ? "active" : ""} onClick={() => theme !== "light" && toggleTheme()}>☀️ Light</button>
          </div>
          <label style={{ fontSize: 12.5, color: "var(--muted)", display: "block", marginBottom: 6 }}>Wallet</label>
          <button className="btn btn-ghost" style={{ color: "var(--down)" }} onClick={() => { if (confirm("Reset wallet, orders, positions, bots and history?")) paper.reset(); }}>Reset virtual wallet</button>
        </div>
      </Reveal>
      <Reveal className="card" delay={0.12} style={{ gridColumn: "1 / -1", borderColor: "rgba(255,93,115,.35)" }}>
        <h3 style={{ color: "var(--down)" }}>Danger zone</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 14px" }}>
          Export a JSON copy of everything we store about you, or permanently delete your account (profile, sessions, tickets and queued emails). Your local paper wallet stays on this device until reset.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={async () => {
            try {
              const data = await api.exportData();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "vertex-trader-my-data.json";
              a.click();
              URL.revokeObjectURL(a.href);
            } catch (e) { alert(e.message); }
          }}>⬇ Export my data</button>
          {!delOpen ? (
            <button className="btn btn-ghost" style={{ color: "var(--down)", borderColor: "rgba(255,93,115,.4)" }} onClick={() => setDelOpen(true)}>Delete my account…</button>
          ) : (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="password" placeholder="Confirm password" value={delPw} onChange={(e) => setDelPw(e.target.value)}
                style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 10, padding: "9px 12px", font: "500 13px var(--font)", outline: "none" }} />
              <button className="btn btn-ghost" style={{ color: "var(--down)", borderColor: "rgba(255,93,115,.4)" }} disabled={delBusy} onClick={async () => {
                if (!confirm("Permanently delete your account and all server-side data? This cannot be undone.")) return;
                setDelBusy(true);
                try { await api.deleteAccount(delPw); await logout(); nav("/"); }
                catch (e) { alert(e.message); setDelBusy(false); }
              }}>{delBusy ? "Deleting…" : "Permanently delete"}</button>
              <button className="btn btn-ghost" onClick={() => { setDelOpen(false); setDelPw(""); }}>Cancel</button>
            </span>
          )}
          <button className="btn btn-ghost" style={{ marginLeft: "auto", color: "var(--down)" }} onClick={logout}>Log out</button>
        </div>
      </Reveal>
    </div>
  );
}

/* ---------------- shell ---------------- */
export default function Dashboard() {
  const { user, authLoading } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "overview";

  if (authLoading) return <Section><div className="container"><div className="spinner" /></div></Section>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Section>
      <div className="container">
        <div className="dash-head">
          <div>
            <div className="kicker">Dashboard</div>
            <h1 style={{ fontSize: "clamp(28px,4vw,40px)" }}>Welcome back, {user.name.split(" ")[0]} 👋</h1>
            <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 14 }}>
              Member since {new Date(user.createdAt).toLocaleDateString()} ·
              KYC <b className={user.kyc?.status === "verified" ? "up" : "down"}>{user.kyc?.status || "not started"}</b> ·
              2FA <b className={user.security?.twoFA ? "up" : "down"}>{user.security?.twoFA ? "on" : "off"}</b>
            </p>
          </div>
          <Link className="btn btn-primary" to="/trade">Open Terminal →</Link>
        </div>

        <div className="dash-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? "active" : ""} onClick={() => setParams({ tab: k })}>{l}</button>
          ))}
        </div>

        {tab === "overview" && <Overview />}
        {tab === "portfolio" && <Portfolio />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "kyc" && <Kyc />}
        {tab === "security" && <Security />}
        {tab === "settings" && <Settings />}
      </div>
    </Section>
  );
}
