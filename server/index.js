/* ============================================================
   Vertex Trader — API server (original code)
   Auth, KYC, 2FA (TOTP), support tickets, user settings.
   Persists to server/data.json
   ============================================================ */
import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = Number(process.env.PORT) || 3001;

/* ---------- persistence ---------- */
let db = { users: [], sessions: {}, tickets: [], subs: [] };
try {
  if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch (e) {
  console.error("data.json unreadable, starting fresh:", e.message);
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(db, null, 1), (e) => e && console.error("save failed", e));
  }, 150);
}

/* ---------- helpers ---------- */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const newToken = () => crypto.randomBytes(24).toString("hex");
const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, currency: u.currency, theme: u.theme,
  createdAt: u.createdAt, role: u.role || "user",
  kyc: { status: u.kyc.status, reviewedAt: u.kyc.reviewedAt || null, reasons: u.kyc.reasons || null, country: u.kyc.country || null },
  security: { twoFA: !!u.twoFASecret && u.twoFAEnabled },
  loginHistory: (u.loginHistory || []).slice(-10).reverse(),
});
const findUserByEmail = (email) => db.users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase().trim());
const getUser = (req) => {
  const tok = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const sess = tok && db.sessions[tok];
  if (!sess) return null;
  return db.users.find((u) => u.id === sess.userId) || null;
};
const logLogin = (u, ok, ip) => {
  u.loginHistory = u.loginHistory || [];
  u.loginHistory.push({ t: Date.now(), ok, ip });
  if (u.loginHistory.length > 40) u.loginHistory = u.loginHistory.slice(-40);
};

/* ---------- TOTP (RFC 6238) ---------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buf) {
  let bits = 0, val = 0, out = "";
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode(s) {
  s = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, val = 0; const out = [];
  for (const ch of s) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpAt(secretB32, counter) {
  const key = base32Decode(secretB32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(off) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
  return code;
}
function totpNow(secretB32) { return totpAt(secretB32, Math.floor(Date.now() / 30000)); }
function totpValid(secretB32, code) {
  const c = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((w) => totpAt(secretB32, c + w) === String(code || "").trim());
}

/* ---------- rate limiting ---------- */
const hits = new Map();
function rateLimit(key, max, windowMs) {
  return (req, res, next) => {
    const id = key + ":" + (req.ip || "x");
    const now = Date.now();
    const arr = (hits.get(id) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Too many requests. Try again shortly." });
    arr.push(now); hits.set(id, arr);
    next();
  };
}

/* ---------- notifications & email delivery ----------
   Real pipeline: every notification is stored in-app; an email is queued for
   each notification whose channel is enabled in the user's settings.
   If SMTP_* env vars are configured, emails are actually delivered via SMTP.
   If not, they remain honestly queued in the outbox (status "queued") and the
   UI reports that delivery is not configured. No fake "sent" states. */
const SMTP_HOST = process.env.SMTP_HOST || "";
const mailer = SMTP_HOST
  ? nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
  })
  : null;
const EMAIL_FROM = process.env.SMTP_FROM || "Vertex Trader <no-reply@vertextrader.app>";

const NOTIF_KEYS = ["security", "trades", "alerts", "product"];
const notifDefaults = () => ({ email: { security: true, trades: true, alerts: true, product: false } });
function ensureNotif(u) {
  if (!u.notifSettings) u.notifSettings = notifDefaults();
  u.notifSettings.email = { ...notifDefaults().email, ...(u.notifSettings.email || {}) };
  if (!Array.isArray(u.notifications)) u.notifications = [];
  return u;
}
function deliverEmail(item) {
  if (!mailer) { item.status = "queued"; save(); return; }
  mailer.sendMail({ from: EMAIL_FROM, to: item.to, subject: item.subject, text: item.text, html: item.html })
    .then(() => { item.status = "sent"; item.sentAt = Date.now(); save(); })
    .catch((e) => { item.status = "failed"; item.error = String(e.message || e).slice(0, 200); save(); });
}
function queueEmail(u, subject, text, opts = {}) {
  db.outbox = db.outbox || [];
  const item = { id: crypto.randomUUID(), userId: u.id, to: u.email, subject, text, html: brandEmail(subject, text, opts), status: mailer ? "sending" : "queued", error: null, time: Date.now(), sentAt: null };
  db.outbox.push(item);
  if (db.outbox.length > 400) db.outbox.splice(0, db.outbox.length - 400);
  deliverEmail(item);
  return item;
}
function notify(u, kind, title, body, opts = {}) {
  ensureNotif(u);
  u.notifications.unshift({ id: crypto.randomUUID(), kind, title, body: body || "", time: Date.now(), read: false });
  if (u.notifications.length > 60) u.notifications.length = 60;
  if (opts.forceEmail || u.notifSettings.email[kind] !== false) {
    queueEmail(u, title, `${body || title}\n\n— Vertex Trader\nManage preferences: Dashboard → Notifications`);
  }
  save();
}

/* ---------- branded HTML email template ----------
   Mirrors the website design system: deep-navy canvas, glass cards,
   emerald/electric-blue accents, honest footer. Table-based for email clients. */
const APP_URL = process.env.APP_URL || "";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function brandEmail(title, bodyText, opts = {}) {
  const paras = String(bodyText || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#c7d2e4;font-family:Arial,Helvetica,sans-serif;">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  const cta = opts.ctaUrl && opts.ctaLabel ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-radius:10px;background:#0d9e77;">
      <a href="${esc(opts.ctaUrl)}" style="display:inline-block;padding:12px 26px;border-radius:10px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${esc(opts.ctaLabel)}</a>
    </td></tr></table>` : "";
  const link = (label, href) => `<a href="${esc(href)}" style="color:#2dd4a7;text-decoration:none;font-size:12px;font-family:Arial,Helvetica,sans-serif;">${esc(label)}</a>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070b14;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b14;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;border-radius:16px;overflow:hidden;border:1px solid #1d2b47;background:#0b1120;">
    <tr><td style="background:#0d1526;border-bottom:1px solid #1d2b47;padding:20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;letter-spacing:.2px;">
          <span style="color:#2dd4a7;">&#9650;</span>&nbsp;VERTEX<span style="color:#4f8cff;">TRADER</span>
        </td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7a94;letter-spacing:.08em;text-transform:uppercase;">Live market data · virtual funds</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:8px 28px 0;">
      <div style="height:3px;border-radius:2px;background:#2dd4a7;"></div>
    </td></tr>
    <tr><td style="padding:26px 28px 8px;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${esc(title)}</h1>
      ${paras}
      ${cta}
    </td></tr>
    <tr><td style="padding:0 28px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;background:#0d1526;border:1px solid #1d2b47;">
        <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8fa0ba;">
          <b style="color:#c7d2e4;">Risk warning:</b> cryptocurrency trading involves substantial risk; leveraged products can liquidate your margin. Vertex Trader is a paper-trading platform — all trading uses virtual funds, no real assets are held and nothing here is financial advice.
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background:#0d1526;border-top:1px solid #1d2b47;padding:18px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7a94;">© 2026 Vertex Trader</td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;">
          ${APP_URL ? link("Support", APP_URL + "/support") + '&nbsp;&nbsp;·&nbsp;&nbsp;' + link("Email preferences", APP_URL + "/dashboard?tab=notifications") + '&nbsp;&nbsp;·&nbsp;&nbsp;' + link("Terminal", APP_URL + "/trade") : "Paper-trading platform · virtual funds only"}
        </td>
      </tr></table>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/* ---------- admin bootstrap ---------- */
function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "admin@vertextrader.app").toLowerCase();
  let a = db.users.find((u) => u.email === email);
  if (!a) {
    const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    const salt = crypto.randomBytes(16).toString("hex");
    a = {
      id: crypto.randomUUID(), name: "Platform Admin", email, salt, hash: hashPw(pw, salt),
      currency: "EUR", theme: "dark", createdAt: Date.now(),
      kyc: { status: "verified", reviewedAt: Date.now() }, twoFASecret: null, twoFAEnabled: false,
      loginHistory: [], notifSettings: notifDefaults(), notifications: [], role: "admin",
    };
    db.users.push(a); save();
    console.log(`[admin] created admin account: ${email} / ${pw}  — override with ADMIN_EMAIL / ADMIN_PASSWORD env vars`);
  } else if (a.role !== "admin") { a.role = "admin"; save(); }
}
const requireAdmin = (req, res, next) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  if (u.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  req.admin = u;
  next();
};
const migrateTicket = (t) => { if (!Array.isArray(t.messages)) t.messages = [{ from: "user", text: t.message, time: t.createdAt }]; return t; };

/* ---------- app ---------- */
const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "14mb" }));

/* ---------- security headers ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});

/* ---------- public site config (announcement bar etc.) ---------- */
db.config = db.config || {
  announcement: {
    enabled: true,
    text: "📡 Live market data by CoinGecko · Trading uses virtual funds (paper trading)",
    link: "/strategies",
    linkLabel: "New here? Follow the step-by-step guide →",
  },
};
app.get("/api/config", (_req, res) => res.json({ config: db.config }));

app.get("/api/health", (_req, res) => res.json({ ok: true, users: db.users.length, time: Date.now() }));

/* ----- auth ----- */
app.post("/api/auth/signup", rateLimit("signup", 12, 10 * 60e3), (req, res) => {
  const { name, email, password, currency } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: "Enter your full name." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(email || ""))) return res.status(400).json({ error: "Enter a valid email address." });
  if (String(password || "").length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (findUserByEmail(email)) return res.status(409).json({ error: "An account with this email already exists. Log in instead." });
  const salt = crypto.randomBytes(16).toString("hex");
  const u = {
    id: crypto.randomUUID(), name: String(name).trim(), email: String(email).trim().toLowerCase(),
    salt, hash: hashPw(password, salt),
    currency: ["EUR", "USD", "GBP", "NGN"].includes(currency) ? currency : "EUR",
    theme: "light",
    createdAt: Date.now(),
    kyc: { status: "none" },
    twoFASecret: null, twoFAEnabled: false,
    loginHistory: [],
    notifSettings: notifDefaults(), notifications: [],
  };
  db.users.push(u);
  const token = newToken();
  db.sessions[token] = { userId: u.id, createdAt: Date.now() };
  logLogin(u, true, req.ip);
  notify(u, "security", "Welcome to Vertex Trader", "Your account was created successfully. Your paper wallet starts with 50,000 " + u.currency + " in virtual funds. Enable two-factor authentication from Dashboard → Security.");
  save();
  res.json({ token, user: publicUser(u) });
});

app.post("/api/auth/login", rateLimit("login", 20, 10 * 60e3), (req, res) => {
  const { email, password } = req.body || {};
  const u = findUserByEmail(email);
  if (!u) return res.status(401).json({ error: "No account found with that email." });
  if (u.suspended) { logLogin(u, false, req.ip); save(); return res.status(403).json({ error: "This account is suspended. Contact support." }); }
  const ok = crypto.timingSafeEqual(Buffer.from(hashPw(String(password || ""), u.salt)), Buffer.from(u.hash));
  if (!ok) { logLogin(u, false, req.ip); save(); return res.status(401).json({ error: "Incorrect password." }); }
  logLogin(u, true, req.ip);
  if (u.twoFAEnabled) {
    const challenge = newToken();
    db.sessions["2fa:" + challenge] = { userId: u.id, challenge: true, createdAt: Date.now() };
    save();
    return res.json({ need2FA: true, challenge });
  }
  const token = newToken();
  db.sessions[token] = { userId: u.id, createdAt: Date.now() };
  notify(u, "security", "New login to your account", `Password login at ${new Date().toLocaleString()} from ${req.ip}. If this wasn't you, change your password immediately from Dashboard → Security.`);
  save();
  res.json({ token, user: publicUser(u) });
});

app.post("/api/auth/2fa/login", rateLimit("2fa", 30, 10 * 60e3), (req, res) => {
  const { challenge, code } = req.body || {};
  const sess = db.sessions["2fa:" + challenge];
  if (!sess || !sess.challenge) return res.status(401).json({ error: "Two-factor session expired. Log in again." });
  const u = db.users.find((x) => x.id === sess.userId);
  if (!u || !totpValid(u.twoFASecret, code)) return res.status(401).json({ error: "Incorrect authentication code." });
  if (u.suspended) return res.status(403).json({ error: "This account is suspended. Contact support." });
  delete db.sessions["2fa:" + challenge];
  const token = newToken();
  db.sessions[token] = { userId: u.id, createdAt: Date.now() };
  notify(u, "security", "New login to your account", `Password + 2FA code login at ${new Date().toLocaleString()} from ${req.ip}. If this wasn't you, disable 2FA keys you don't recognise and change your password.`);
  save();
  res.json({ token, user: publicUser(u) });
});

app.post("/api/auth/logout", (req, res) => {
  const tok = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  delete db.sessions[tok];
  save();
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  res.json({ user: publicUser(u) });
});

app.patch("/api/me", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const { currency, theme, name } = req.body || {};
  if (currency && ["EUR", "USD", "GBP", "NGN"].includes(currency)) u.currency = currency;
  if (theme && ["dark", "light"].includes(theme)) u.theme = theme;
  if (name && String(name).trim().length >= 2) u.name = String(name).trim().slice(0, 80);
  save();
  res.json({ user: publicUser(u) });
});

app.post("/api/auth/password", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const { current, next } = req.body || {};
  const ok = crypto.timingSafeEqual(Buffer.from(hashPw(String(current || ""), u.salt)), Buffer.from(u.hash));
  if (!ok) return res.status(401).json({ error: "Current password is incorrect." });
  if (String(next || "").length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
  u.salt = crypto.randomBytes(16).toString("hex");
  u.hash = hashPw(next, u.salt);
  notify(u, "security", "Your password was changed", `Changed at ${new Date().toLocaleString()}. If you did not do this, contact support immediately.`);
  save();
  res.json({ ok: true });
});

/* ----- 2FA management ----- */
app.post("/api/auth/2fa/setup", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  if (u.twoFAEnabled) return res.status(400).json({ error: "Two-factor authentication is already enabled." });
  u.twoFASecret = base32Encode(crypto.randomBytes(20));
  save();
  const uri = `otpauth://totp/VertexTrader:${encodeURIComponent(u.email)}?secret=${u.twoFASecret}&issuer=VertexTrader&period=30&digits=6`;
  res.json({ secret: u.twoFASecret, otpauth: uri });
});

app.post("/api/auth/2fa/verify", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  if (!u.twoFASecret) return res.status(400).json({ error: "Start 2FA setup first." });
  if (!totpValid(u.twoFASecret, req.body?.code)) return res.status(400).json({ error: "Incorrect code. Check your authenticator app and try again." });
  u.twoFAEnabled = true;
  notify(u, "security", "Two-factor authentication enabled", "TOTP two-factor authentication is now active on your account.");
  save();
  res.json({ ok: true, user: publicUser(u) });
});

app.post("/api/auth/2fa/disable", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  if (!u.twoFAEnabled) return res.json({ ok: true, user: publicUser(u) });
  if (!totpValid(u.twoFASecret, req.body?.code)) return res.status(400).json({ error: "Enter your current 2FA code to disable." });
  u.twoFAEnabled = false; u.twoFASecret = null;
  notify(u, "security", "Two-factor authentication disabled", "2FA was turned off. Your account is now protected by password only — we recommend re-enabling it.");
  save();
  res.json({ ok: true, user: publicUser(u) });
});

/* ----- KYC ----- */
app.get("/api/kyc", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  res.json({ kyc: publicUser(u).kyc, stored: u.kyc.form ? { ...u.kyc.form, idNumber: u.kyc.form.idNumber } : null });
});

app.post("/api/kyc", rateLimit("kyc", 10, 10 * 60e3), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const f = req.body || {};
  const reasons = [];
  const full = String(f.fullName || "").trim();
  if (full.split(/\s+/).length < 2 || full.length < 4) reasons.push("Full legal name must include first and last name.");
  const dob = new Date(f.dob || "");
  if (isNaN(dob.getTime())) reasons.push("Enter a valid date of birth.");
  else {
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) reasons.push("You must be at least 18 years old.");
    if (age > 120) reasons.push("Check the date of birth entered.");
  }
  if (!String(f.country || "").trim()) reasons.push("Country of residence is required.");
  if (!String(f.address || "").trim() || String(f.address).trim().length < 8) reasons.push("Enter a full residential address.");
  if (!["passport", "national_id", "drivers_license"].includes(f.idType)) reasons.push("Select a valid ID type.");
  if (String(f.idNumber || "").replace(/\s/g, "").length < 5) reasons.push("ID number looks too short.");
  const docs = Array.isArray(f.documents) ? f.documents : [];
  if (docs.length < 1) reasons.push("Upload a photo of your ID document.");
  for (const d of docs) {
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(String(d.dataUrl || ""))) { reasons.push(`"${d.name || "file"}" must be a PNG/JPG/WebP image.`); break; }
    if (String(d.dataUrl).length > 9_000_000) { reasons.push(`"${d.name || "file"}" is larger than ~6.5 MB.`); break; }
  }
  u.kyc.form = { fullName: full, dob: f.dob, country: f.country, address: f.address, idType: f.idType, idNumber: f.idNumber };
  if (reasons.length) {
    u.kyc.status = "rejected"; u.kyc.reasons = reasons; u.kyc.reviewedAt = Date.now();
    notify(u, "security", "KYC verification needs attention", "Automated validation could not verify your submission: " + reasons.join(" ") + " You can correct and resubmit at any time.");
    save();
    return res.status(422).json({ status: "rejected", reasons });
  }
  u.kyc.status = "verified"; u.kyc.reasons = null; u.kyc.reviewedAt = Date.now();
  notify(u, "security", "KYC verification approved", "Automated validation accepted your identity details and document. Your account is fully verified.");
  save();
  res.json({ status: "verified", reviewedAt: u.kyc.reviewedAt });
});

/* ----- support tickets ----- */
app.post("/api/support", rateLimit("support", 15, 10 * 60e3), (req, res) => {
  const { topic, message, email, name } = req.body || {};
  if (!topic || !message || String(message).trim().length < 10) return res.status(400).json({ error: "Choose a topic and describe your issue (at least 10 characters)." });
  const u = getUser(req);
  const t = {
    id: "VT-" + crypto.randomInt(100000, 999999),
    topic, message: String(message).slice(0, 4000),
    email: u ? u.email : String(email || "").trim(), name: u ? u.name : String(name || "").trim(),
    userId: u ? u.id : null, createdAt: Date.now(), status: "open",
    messages: [{ from: "user", text: String(message).slice(0, 4000), time: Date.now() }],
  };
  db.tickets.push(t);
  if (u) notify(u, "product", `Support ticket ${t.id} received`, `We received your "${topic}" message. This ticket is now an open conversation — reply to it any time from the support page or your dashboard.`);
  save();
  res.json({ id: t.id, createdAt: t.createdAt });
});

app.get("/api/support/mine", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  res.json({ tickets: db.tickets.filter((t) => t.userId === u.id).map(migrateTicket).slice(-20).reverse() });
});

/* user replies inside their ticket conversation */
app.post("/api/support/:id/reply", rateLimit("treply", 30, 10 * 60e3), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Log in to reply in a ticket conversation." });
  const t = db.tickets.find((x) => x.id === req.params.id && x.userId === u.id);
  if (!t) return res.status(404).json({ error: "Ticket not found." });
  const text = String(req.body?.text || "").trim();
  if (text.length < 2) return res.status(400).json({ error: "Write a message first." });
  if (t.status === "closed") return res.status(400).json({ error: "This ticket is closed. Open a new one if you need more help." });
  migrateTicket(t);
  t.messages.push({ from: "user", text: text.slice(0, 4000), time: Date.now() });
  if (t.status === "answered") t.status = "open";
  save();
  res.json({ ticket: t });
});

/* ----- newsletter ----- */
/* ----- password reset (token via branded email / outbox) ----- */
app.post("/api/auth/forgot", rateLimit("forgot", 6, 30 * 60e3), (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const u = findUserByEmail(email);
  if (u && !u.suspended) {
    const token = newToken();
    db.resets = db.resets || {};
    db.resets[token] = { userId: u.id, exp: Date.now() + 30 * 60e3 };
    const link = APP_URL ? `${APP_URL}/login?reset=${token}` : "";
    queueEmail(u, "Password reset request",
      `We received a request to reset your Vertex Trader password.\n\nReset token (valid 30 minutes): ${token}${link ? `\n\nOr open: ${link}` : ""}\n\nIf you did not request this, ignore this email — your password stays unchanged.`);
    save();
  }
  /* never reveal whether the account exists */
  res.json({ ok: true, message: "If an account exists for that address, a reset email has been generated." });
});

app.post("/api/auth/reset", rateLimit("reset", 10, 30 * 60e3), (req, res) => {
  const { token, password } = req.body || {};
  const r = (db.resets || {})[String(token || "")];
  if (!r || r.exp < Date.now()) return res.status(400).json({ error: "Reset token is invalid or expired. Request a new one." });
  if (String(password || "").length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
  const u = db.users.find((x) => x.id === r.userId);
  if (!u) return res.status(400).json({ error: "Reset token is invalid or expired. Request a new one." });
  u.salt = crypto.randomBytes(16).toString("hex");
  u.hash = hashPw(password, u.salt);
  delete db.resets[token];
  for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[tok];
  notify(u, "security", "Your password was reset", `Reset completed at ${new Date().toLocaleString()}. All sessions were signed out. If this wasn't you, contact support immediately.`);
  save();
  res.json({ ok: true });
});

/* ----- privacy rights: export & delete ----- */
app.get("/api/me/export", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const { salt, hash, twoFASecret, ...safe } = u;
  void salt; void hash; void twoFASecret;
  res.json({
    exportedAt: Date.now(),
    account: safe,
    tickets: db.tickets.filter((t) => t.userId === u.id),
    emails: (db.outbox || []).filter((o) => o.userId === u.id).map(({ html, ...rest }) => rest),
  });
});

app.delete("/api/me", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const ok = crypto.timingSafeEqual(Buffer.from(hashPw(String(req.body?.password || ""), u.salt)), Buffer.from(u.hash));
  if (!ok) return res.status(401).json({ error: "Password incorrect — account not deleted." });
  if (u.role === "admin" && db.users.filter((x) => x.role === "admin").length === 1) return res.status(400).json({ error: "The last admin account cannot be deleted." });
  db.users = db.users.filter((x) => x.id !== u.id);
  for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[tok];
  db.tickets = db.tickets.filter((t) => t.userId !== u.id);
  db.outbox = (db.outbox || []).filter((o) => o.userId !== u.id);
  db.funding = (db.funding || []).filter((r) => r.userId !== u.id);
  save();
  res.json({ ok: true });
});

/* ----- notifications: settings, feed, events, test ----- */
app.get("/api/notifications", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  ensureNotif(u);
  res.json({
    settings: u.notifSettings,
    items: u.notifications.slice(0, 40),
    outbox: (db.outbox || []).filter((o) => o.userId === u.id).slice(-12).reverse(),
    emailEnabled: !!mailer,
  });
});

app.patch("/api/notifications/settings", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  ensureNotif(u);
  const e = req.body?.email || {};
  for (const k of NOTIF_KEYS) if (typeof e[k] === "boolean") u.notifSettings.email[k] = e[k];
  save();
  res.json({ settings: u.notifSettings });
});

app.post("/api/notifications/read", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  ensureNotif(u);
  const id = req.body?.id;
  u.notifications.forEach((n) => { if (!id || n.id === id) n.read = true; });
  save();
  res.json({ ok: true, unread: u.notifications.filter((n) => !n.read).length });
});

app.post("/api/notifications/event", rateLimit("evt", 60, 10 * 60e3), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const { kind, title, body } = req.body || {};
  if (!["trades", "alerts"].includes(kind) || !title) return res.status(400).json({ error: "Invalid notification event." });
  ensureNotif(u);
  notify(u, kind, String(title).slice(0, 140), String(body || "").slice(0, 400));
  res.json({ ok: true });
});

app.post("/api/notifications/test", rateLimit("tmail", 6, 10 * 60e3), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  const item = queueEmail(u, "Vertex Trader — test email", "If you can read this, email delivery is configured and working for your account.");
  res.json({ ok: true, status: item.status, emailEnabled: !!mailer });
});

/* ----- admin: stats, users, email composer, ticket conversations ----- */
/* ============================================================
   Funding requests — deposits & withdrawals are VERIFIED MANUALLY
   by an admin before funds move. Payments themselves are unchanged:
   the wallet is virtual, no real money or payment processor involved.
   Flow: user submits request (withdrawals reserve funds client-side)
   → admin approves/rejects (reason required to reject) → user gets
   in-app notification + branded email → client applies the credit or
   refund to the paper wallet.
   ============================================================ */
app.post("/api/funding/request", rateLimit("funding", 20, 10 * 60e3), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  if (u.suspended) return res.status(403).json({ error: "Account suspended — contact support." });
  const type = req.body?.type;
  if (!["deposit", "withdraw"].includes(type)) return res.status(400).json({ error: "Type must be deposit or withdraw." });
  const asset = String(req.body?.asset || "").trim();
  const assetLabel = String(req.body?.assetLabel || asset).trim().slice(0, 24);
  const amount = Number(req.body?.amount);
  if (!asset || !/^[A-Za-z0-9-]{2,48}$/.test(asset)) return res.status(400).json({ error: "Invalid asset." });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Enter a valid amount." });
  if (type === "deposit" && amount > 10_000_000) return res.status(400).json({ error: "Single virtual deposits are capped at 10,000,000." });
  db.funding = db.funding || [];
  if (db.funding.filter((r) => r.userId === u.id && r.status === "pending").length >= 8)
    return res.status(429).json({ error: "Too many pending requests — wait for admin verification first." });
  const r = {
    id: "FR-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    userId: u.id, email: u.email, name: u.name,
    type, asset, assetLabel, amount,
    status: "pending", reason: null,
    createdAt: Date.now(), decidedAt: null, decidedBy: null,
  };
  db.funding.unshift(r);
  if (db.funding.length > 500) db.funding.length = 500;
  save();
  res.status(201).json({ request: r });
});

app.get("/api/funding/mine", (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  res.json({ requests: (db.funding || []).filter((r) => r.userId === u.id) });
});

app.get("/api/admin/funding", requireAdmin, (req, res) => {
  let list = db.funding || [];
  const status = String(req.query.status || "");
  if (["pending", "approved", "rejected"].includes(status)) list = list.filter((r) => r.status === status);
  res.json({ requests: list, pendingCount: (db.funding || []).filter((r) => r.status === "pending").length });
});

app.post("/api/admin/funding/:id/decide", rateLimit("fundingdecide", 120, 10 * 60e3), requireAdmin, (req, res) => {
  const r = (db.funding || []).find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Funding request not found." });
  if (r.status !== "pending") return res.status(400).json({ error: "This request was already decided." });
  const action = req.body?.action;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Action must be approve or reject." });
  const reason = String(req.body?.reason || "").trim().slice(0, 300);
  if (action === "reject" && !reason) return res.status(400).json({ error: "A reason is required to reject a funding request." });
  const u = db.users.find((x) => x.id === r.userId);
  r.status = action === "approve" ? "approved" : "rejected";
  r.reason = reason || null;
  r.decidedAt = Date.now();
  r.decidedBy = req.admin.email;
  save();
  if (u) {
    const amt = `${r.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${r.assetLabel || r.asset}`;
    const label = r.type === "deposit" ? "Deposit" : "Withdrawal";
    const title = `${label} ${r.status} — ${amt}`;
    const body = r.status === "approved"
      ? `Your ${r.type} request ${r.id} for ${amt} passed manual verification and was ${r.type === "deposit" ? "credited to your paper wallet" : "completed"}. Open the funding page to see your updated balance and history.`
      : `Your ${r.type} request ${r.id} for ${amt} was declined during manual verification.\n\nReason: ${reason}\n\nYou can submit a corrected request any time from the funding page.`;
    ensureNotif(u);
    u.notifications.unshift({ id: crypto.randomUUID(), kind: "funding", title, body, time: Date.now(), read: false });
    if (u.notifications.length > 60) u.notifications.length = 60;
    queueEmail(u, title, body, APP_URL ? { ctaUrl: APP_URL + "/funding", ctaLabel: "Open funding page" } : {});
    save();
  }
  res.json({ request: r });
});

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  const ob = db.outbox || [];
  res.json({
    users: db.users.length,
    admins: db.users.filter((u) => u.role === "admin").length,
    verified: db.users.filter((u) => u.kyc?.status === "verified").length,
    ticketsOpen: db.tickets.filter((t) => t.status === "open").length,
    ticketsTotal: db.tickets.length,
    fundingPending: (db.funding || []).filter((r) => r.status === "pending").length,
    fundingTotal: (db.funding || []).length,
    emailsSent: ob.filter((o) => o.status === "sent").length,
    emailsQueued: ob.filter((o) => o.status === "queued" || o.status === "sending").length,
    emailsFailed: ob.filter((o) => o.status === "failed").length,
    subscribers: (db.subs || []).length,
    emailEnabled: !!mailer,
  });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  res.json({
    users: db.users.map((u) => ({
      id: u.id, name: u.name, email: u.email, role: u.role || "user",
      kyc: u.kyc?.status || "none", twoFA: !!u.twoFAEnabled, suspended: !!u.suspended, createdAt: u.createdAt,
    })).sort((a, b) => b.createdAt - a.createdAt),
  });
});

app.post("/api/admin/users/:id/role", requireAdmin, (req, res) => {
  const t = db.users.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "User not found." });
  const role = req.body?.role;
  if (!["admin", "user"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  if (t.id === req.admin.id && role !== "admin") return res.status(400).json({ error: "You cannot demote yourself." });
  t.role = role;
  save();
  res.json({ ok: true, user: { id: t.id, role: t.role } });
});

app.post("/api/admin/users/:id/suspend", requireAdmin, (req, res) => {
  const t = db.users.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "User not found." });
  if (t.id === req.admin.id) return res.status(400).json({ error: "You cannot suspend your own account." });
  t.suspended = !!req.body?.suspended;
  if (t.suspended) for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === t.id) delete db.sessions[tok];
  save();
  res.json({ ok: true, suspended: !!t.suspended });
});

app.get("/api/admin/outbox", requireAdmin, (_req, res) => {
  res.json({ outbox: (db.outbox || []).slice(-60).reverse(), emailEnabled: !!mailer });
});

app.post("/api/admin/outbox/:id/resend", requireAdmin, (req, res) => {
  const item = (db.outbox || []).find((o) => o.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Email not found." });
  item.status = mailer ? "sending" : "queued";
  item.error = null;
  item.time = Date.now();
  deliverEmail(item);
  save();
  res.json({ ok: true, status: item.status });
});

app.patch("/api/admin/config", requireAdmin, (req, res) => {
  const a = req.body?.announcement;
  if (!a || typeof a !== "object") return res.status(400).json({ error: "Invalid announcement payload." });
  db.config.announcement = {
    enabled: a.enabled !== false,
    text: String(a.text || "").slice(0, 220) || db.config.announcement.text,
    link: String(a.link || "").slice(0, 120),
    linkLabel: String(a.linkLabel || "").slice(0, 80),
  };
  save();
  res.json({ config: db.config });
});

app.post("/api/admin/email", rateLimit("adminmail", 20, 10 * 60e3), requireAdmin, (req, res) => {
  const { to, subject, body, ctaLabel, ctaUrl } = req.body || {};
  if (!subject || String(subject).trim().length < 3) return res.status(400).json({ error: "Subject is required." });
  if (!body || String(body).trim().length < 10) return res.status(400).json({ error: "Message body must be at least 10 characters." });
  let recipients = [];
  if (to === "all") recipients = db.users.filter((u) => u.role !== "admin");
  else if (Array.isArray(to)) recipients = db.users.filter((u) => to.includes(u.id));
  else recipients = db.users.filter((u) => u.id === String(to) || u.email === String(to).toLowerCase().trim());
  if (!recipients.length) return res.status(400).json({ error: "No matching recipients." });
  const opts = { ctaLabel, ctaUrl };
  const results = recipients.slice(0, 100).map((u) => {
    ensureNotif(u);
    u.notifications.unshift({ id: crypto.randomUUID(), kind: "product", title: String(subject).slice(0, 140), body: String(body).slice(0, 300), time: Date.now(), read: false });
    if (u.notifications.length > 60) u.notifications.length = 60;
    const item = queueEmail(u, String(subject).slice(0, 140), String(body), opts);
    return { email: u.email, status: item.status };
  });
  save();
  res.json({ ok: true, sent: results.length, results: results.slice(0, 20), emailEnabled: !!mailer });
});

app.get("/api/admin/tickets", requireAdmin, (_req, res) => {
  res.json({ tickets: db.tickets.map(migrateTicket).slice().reverse() });
});

app.post("/api/admin/tickets/:id/reply", rateLimit("adminreply", 40, 10 * 60e3), requireAdmin, (req, res) => {
  const t = db.tickets.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket not found." });
  const text = String(req.body?.text || "").trim();
  if (text.length < 2) return res.status(400).json({ error: "Write a reply first." });
  migrateTicket(t);
  t.messages.push({ from: "support", text: text.slice(0, 4000), time: Date.now() });
  t.status = "answered";
  const u = t.userId && db.users.find((x) => x.id === t.userId);
  if (u) {
    notify(u, "product", `Support replied to ${t.id}`, text.slice(0, 300), { forceEmail: true });
  }
  save();
  res.json({ ticket: t });
});

app.post("/api/admin/tickets/:id/status", requireAdmin, (req, res) => {
  const t = db.tickets.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket not found." });
  const s = req.body?.status;
  if (!["open", "answered", "closed"].includes(s)) return res.status(400).json({ error: "Invalid status." });
  t.status = s;
  save();
  res.json({ ticket: t });
});

app.post("/api/subscribe", rateLimit("sub", 20, 10 * 60e3), (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!db.subs.includes(email)) { db.subs.push(email); save(); }
  res.json({ ok: true });
});

/* ---------- production: serve the built SPA from dist/ ---------- */
const DIST = path.join(__dirname, "..", "dist");
if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(express.static(DIST, {
    index: false,
    setHeaders(res, filePath) {
      if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(DIST, "index.html"));
  });
  console.log(`Serving production build from ${DIST}`);
}

ensureAdmin();
app.listen(PORT, "0.0.0.0", () => console.log(`Vertex server listening on :${PORT}${fs.existsSync(path.join(DIST, "index.html")) ? " (API + production SPA)" : " (API only — run npm run build to serve the SPA)"}`));
