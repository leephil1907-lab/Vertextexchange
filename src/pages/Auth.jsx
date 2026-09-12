import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Section } from "../components/ui.jsx";
import { useApp } from "../app-context.jsx";
import { api } from "../services/api.js";

const BENEFITS = [
  "Your wallet, orders and history saved to your account",
  "Portfolio P&L tracking across sessions",
  "KYC verification flow and account security tools",
  "Real two-factor authentication (RFC-6238 TOTP)",
];

function pwStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export function Signup() {
  const { signup, fiat, setFiat } = useApp();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", pw: "", pw2: "" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const strength = pwStrength(form.pw);
  const colors = ["#e0455c", "#e0455c", "#f5b840", "#f5b840", "#2dd4a7"];

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (form.pw !== form.pw2) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      await signup(form.name, form.email, form.pw, fiat);
      nav("/dashboard");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Section>
      <div className="container auth-wrap" style={{ paddingTop: 30, paddingBottom: 30 }}>
        <motion.div className="auth-side" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <div className="kicker">Create account</div>
          <h2>Start trading with <span className="grad-text">live market data</span></h2>
          <p>Your account keeps your virtual wallet, open orders, DCA bots and performance history — on this device, tied to your login.</p>
          <ul>{BENEFITS.map((b) => <li key={b}>{b}</li>)}</ul>
        </motion.div>
        <motion.div className="form-card" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h2 style={{ fontSize: 23, marginBottom: 22 }}>Sign up</h2>
          {err && <div className="auth-error">{err}</div>}
          <form onSubmit={submit}>
            <div className="field"><label>Full name</label><input required minLength={2} value={form.name} onChange={set("name")} placeholder="Jane Doe" autoComplete="name" /></div>
            <div className="field"><label>Email</label><input required type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" /></div>
            <div className="field">
              <label>Password</label>
              <input required type="password" minLength={8} value={form.pw} onChange={set("pw")} placeholder="Min. 8 characters" autoComplete="new-password" />
              <div className="pw-meter"><i style={{ width: (strength / 4) * 100 + "%", background: colors[strength] }} /></div>
              <small style={{ color: "var(--muted)", fontSize: 12 }}>{["Very weak", "Weak", "Fair", "Strong", "Excellent"][strength]} — mix length, case, numbers & symbols</small>
            </div>
            <div className="field"><label>Confirm password</label><input required type="password" minLength={8} value={form.pw2} onChange={set("pw2")} placeholder="Repeat password" autoComplete="new-password" /></div>
            <div className="field">
              <label>Display currency (default Euro)</label>
              <select value={fiat} onChange={(e) => setFiat(e.target.value)}>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="GBP">GBP — Pound Sterling (£)</option>
                <option value="NGN">NGN — Nigerian Naira (₦)</option>
              </select>
            </div>
            <label className="consent">
              <input type="checkbox" required />
              I understand that crypto trading involves <b>substantial risk</b> — leveraged positions can be liquidated and I can lose my deposited balance — and I accept the terms & risk warning.
            </label>
            <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }} className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">
              {busy ? "Creating account…" : "Create account"}
            </motion.button>
          </form>
          <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)", textAlign: "center" }}>
            Already registered? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>Log in</Link>
          </p>
        </motion.div>
      </div>
    </Section>
  );
}

export function Login() {
  const { login, finishLogin } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", pw: "" });
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [view, setView] = useState(params.get("reset") ? "forgot" : "login");
  const [resetToken, setResetToken] = useState(params.get("reset") || "");
  const [resetPw, setResetPw] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await login(form.email, form.pw);
      if (r.need2FA) setChallenge(r.challenge);
      else { finishLogin(r.token, r.user); nav("/dashboard"); }
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const submit2FA = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await api.login2FA(challenge, code);
      finishLogin(r.token, r.user);
      nav("/dashboard");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const submitForgot = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await api.forgot(forgotEmail); setForgotSent(true); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const submitReset = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await api.reset(resetToken, resetPw);
      setView("login"); setOk("Password updated — log in with your new password.");
      setResetToken(""); setResetPw(""); setForgotSent(false);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <Section>
      <div className="container auth-wrap" style={{ paddingTop: 30, paddingBottom: 30 }}>
        <motion.div className="auth-side" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}>
          <div className="kicker">Welcome back</div>
          <h2>Log in to your <span className="grad-text">trading dashboard</span></h2>
          <p>Sessions are token-based, passwords are scrypt-hashed, and accounts with 2FA enabled require a code from your authenticator app.</p>
          <ul>{BENEFITS.map((b) => <li key={b}>{b}</li>)}</ul>
        </motion.div>
        <motion.div className="form-card" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {view === "forgot" ? (
            <>
              <h2 style={{ fontSize: 23, marginBottom: 8 }}>Reset password</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>
                Enter your email to generate a reset token. It's delivered by branded email — on servers without SMTP configured it stays in your outbox (Dashboard → Notifications or admin Outbox).
              </p>
              {err && <div className="auth-error">{err}</div>}
              {ok && <div className="auth-ok">{ok}</div>}
              {!forgotSent ? (
                <form onSubmit={submitForgot}>
                  <div className="field"><label>Account email</label><input required type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" /></div>
                  <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">{busy ? "Generating…" : "Send reset token"}</motion.button>
                </form>
              ) : (
                <form onSubmit={submitReset}>
                  <div className="auth-ok" style={{ marginBottom: 14 }}>Reset token generated for {forgotEmail}. Paste it below with your new password.</div>
                  <div className="field"><label>Reset token</label><input required value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="64-character token from the email" style={{ fontFamily: "monospace", fontSize: 12 }} /></div>
                  <div className="field"><label>New password</label><input required type="password" minLength={8} value={resetPw} onChange={(e) => setResetPw(e.target.value)} autoComplete="new-password" /></div>
                  <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">{busy ? "Updating…" : "Set new password"}</motion.button>
                </form>
              )}
              <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => { setView("login"); setErr(null); setForgotSent(false); }}>← Back to log in</button>
            </>
          ) : challenge ? (
            <>
              <h2 style={{ fontSize: 23, marginBottom: 8 }}>Two-factor authentication</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>Enter the 6-digit code from your authenticator app.</p>
              {err && <div className="auth-error">{err}</div>}
              <form onSubmit={submit2FA}>
                <div className="field">
                  <label>Authentication code</label>
                  <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus
                    style={{ letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 800 }} />
                </div>
                <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">{busy ? "Verifying…" : "Verify & log in"}</motion.button>
                <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => { setChallenge(null); setCode(""); setErr(null); }}>← Back</button>
              </form>
            </>
          ) : (
              <>
              <h2 style={{ fontSize: 23, marginBottom: 22 }}>Log in</h2>
              {err && <div className="auth-error">{err}</div>}
              {ok && <div className="auth-ok">{ok}</div>}
              <form onSubmit={submit}>
                <div className="field"><label>Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" /></div>
                <div className="field"><label>Password</label><input required type="password" value={form.pw} onChange={(e) => setForm({ ...form, pw: e.target.value })} placeholder="••••••••" autoComplete="current-password" /></div>
                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }} className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">{busy ? "Logging in…" : "Log in"}</motion.button>
              </form>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 13.5 }}>
                <button type="button" onClick={() => { setView("forgot"); setErr(null); setOk(null); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Forgot password?</button>
                <Link to="/signup" style={{ color: "var(--muted)" }}>Create account →</Link>
              </div>
              </>
          )}
        </motion.div>
      </div>
    </Section>
  );
}
