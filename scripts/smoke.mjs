/* Reproducible backend smoke test. Usage: npm run test:api  (server must be running on :3001) */
import crypto from "crypto";

const B = process.env.API_URL || "http://localhost:3001";
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? (pass++, console.log("  ✓", name)) : (fail++, console.error("  ✗", name)); };

async function call(path, data, token, method) {
  const res = await fetch(B + path, {
    method: method || (data !== undefined ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  let body = null; try { body = await res.json(); } catch (e) { }
  return { status: res.status, body };
}
function b32decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, val = 0; const out = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    val = (val << 5) | A.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpCode(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac("sha1", b32decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, "0");
}

const tag = Date.now().toString().slice(-6);
const email = `smoke${tag}@example.com`;
const pw = "Str0ng!Pass99";

console.log("Vertex Trader API smoke test →", B);

const h = await call("/api/health");
ok("health", h.status === 200 && h.body.ok === true);

const cfg = await call("/api/config");
ok("public config", cfg.status === 200 && !!cfg.body.config.announcement);

const su = await call("/api/auth/signup", { name: "Smoke Test", email, password: pw, currency: "EUR" });
ok("signup", su.status === 200 && !!su.body.token);
const tok = su.body.token;

const me = await call("/api/me", undefined, tok);
ok("session + profile", me.status === 200 && me.body.user.email === email && me.body.user.role === "user");

const notif = await call("/api/notifications", undefined, tok);
ok("welcome notification + queued email", notif.status === 200 && notif.body.items.length >= 1 && notif.body.outbox.length >= 1 && notif.body.outbox[0].status === "queued");

const set = await call("/api/notifications/settings", { email: { trades: false } }, tok, "PATCH");
ok("notification settings partial patch", set.status === 200 && set.body.settings.email.trades === false && set.body.settings.email.security === true);

const kycBad = await call("/api/kyc", { fullName: "Smoke Test", dob: "2015-01-01", country: "Germany", address: "Hauptstr 1, Berlin", idType: "passport", idNumber: "C01X00T47", documents: [{ name: "i.png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }] }, tok);
ok("KYC minor rejected", kycBad.status === 422 && kycBad.body.reasons.some((r) => r.includes("18")));

const kycOk = await call("/api/kyc", { fullName: "Smoke Test", dob: "1990-05-05", country: "Germany", address: "Hauptstr 1, 10115 Berlin", idType: "passport", idNumber: "C01X00T47", documents: [{ name: "i.png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }] }, tok);
ok("KYC verified", kycOk.status === 200 && kycOk.body.status === "verified");

const t2 = await call("/api/auth/2fa/setup", {}, tok);
ok("2FA setup", t2.status === 200 && !!t2.body.secret);
const ver = await call("/api/auth/2fa/verify", { code: totpCode(t2.body.secret) }, tok);
ok("2FA verify with real TOTP", ver.status === 200 && ver.body.user.security.twoFA === true);

const li = await call("/api/auth/login", { email, password: pw });
ok("login requires 2FA now", li.status === 200 && li.body.need2FA === true);
const li2 = await call("/api/auth/2fa/login", { challenge: li.body.challenge, code: totpCode(t2.body.secret) });
ok("2FA login", li2.status === 200 && !!li2.body.token);

const tk = await call("/api/support", { topic: "Bug report", message: "Smoke test ticket message body." }, tok);
ok("ticket created", tk.status === 200 && tk.body.id.startsWith("VT-"));
const rep = await call(`/api/support/${tk.body.id}/reply`, { text: "User reply in thread." }, tok);
ok("ticket conversation reply", rep.status === 200 && rep.body.ticket.messages.length === 2);

const fr = await call("/api/auth/forgot", { email });
ok("forgot (no leak)", fr.status === 200 && fr.body.ok === true);

const exp = await call("/api/me/export", undefined, tok);
ok("data export", exp.status === 200 && exp.body.account.email === email && !("hash" in exp.body.account));

const adm = await call("/api/admin/stats", undefined, tok);
ok("admin blocked for users", adm.status === 403);

const admLogin = await call("/api/auth/login", { email: process.env.ADMIN_EMAIL || "admin@vertextrader.app", password: process.env.ADMIN_PASSWORD || "VertexAdmin!2026" });
if (admLogin.status === 200 && admLogin.body.token) {
  const at = admLogin.body.token;
  const st = await call("/api/admin/stats", undefined, at);
  ok("admin stats", st.status === 200 && typeof st.body.users === "number");
  const ob = await call("/api/admin/outbox", undefined, at);
  ok("admin outbox", ob.status === 200 && Array.isArray(ob.body.outbox));
  const ar = await call(`/api/admin/tickets/${tk.body.id}/reply`, { text: "Support answer to smoke ticket." }, at);
  ok("admin ticket reply", ar.status === 200 && ar.body.ticket.status === "answered");
} else {
  console.log("  (admin login skipped — set ADMIN_EMAIL/ADMIN_PASSWORD env to include)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
