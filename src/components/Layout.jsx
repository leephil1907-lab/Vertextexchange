import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { useApp } from "../app-context.jsx";
import { api } from "../services/api.js";
import { priceStore, getMarkets, CURRENCIES, fmtMoney } from "../services/coingecko.js";

/* ---------- brand mark (original) ---------- */
export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <motion.path d="M4.5 6L16 26L27.5 6" stroke="url(#vg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeInOut" }} />
      <motion.circle cx="27.5" cy="6" r="3.4" fill="#B8F229" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: "spring", stiffness: 300 }} />
      <circle cx="4.5" cy="6" r="2" fill="#4f8cff" />
      <defs><linearGradient id="vg" x1="4" y1="26" x2="28" y2="6"><stop stopColor="#B8F229" /><stop offset="1" stopColor="#4f8cff" /></linearGradient></defs>
    </svg>
  );
}

/* ---------- announcement bar (admin-configurable) ---------- */
function Announcement() {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("vt_announce_off") === "1");
  const [cfg, setCfg] = useState(null);
  useEffect(() => { api.config?.().then((r) => setCfg(r.config?.announcement)).catch(() => { }); }, []);
  const a = cfg || { enabled: true, text: "📡 Live market data by CoinGecko · Trading uses virtual funds (paper trading)", link: "/strategies", linkLabel: "New here? Follow the step-by-step guide →" };
  return (
    <AnimatePresence initial={false}>
      {!hidden && a.enabled !== false && (
        <motion.div className="announce" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
          <span>{a.text}{a.link && a.linkLabel && <> · <Link to={a.link}>{a.linkLabel}</Link>}</>}</span>
          <button className="x" aria-label="Dismiss" onClick={() => { sessionStorage.setItem("vt_announce_off", "1"); setHidden(true); }}>✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- live ticker from real quotes ---------- */
const TICK_IDS = ["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "avalanche-2", "chainlink", "litecoin", "tron"];
function Ticker() {
  const { fiat } = useApp();
  const [, force] = useState(0);
  const [names, setNames] = useState({});
  useEffect(() => {
    priceStore.configure(TICK_IDS, CURRENCIES[fiat].vs, 25000);
    return priceStore.subscribe(() => force((v) => v + 1));
  }, [fiat]);
  useEffect(() => {
    getMarkets(CURRENCIES[fiat].vs, 1, 100).then((r) => {
      const map = {};
      r.data.forEach((c) => { map[c.id] = { symbol: c.symbol.toUpperCase(), image: c.image }; });
      setNames(map);
    }).catch(() => { });
  }, [fiat]);

  const items = TICK_IDS.map((id) => {
    const q = priceStore.quotes[id];
    if (!q) return null;
    const nm = names[id];
    return { sym: nm ? nm.symbol : id.toUpperCase(), px: fmtMoney(q.price, fiat), chg: q.change24h };
  }).filter(Boolean);
  if (!items.length) return <div className="ticker"><div className="ticker-track"><span className="tick"><span className="sym">Loading live prices…</span></span></div></div>;
  const row = items.map((t, i) => (
    <span className="tick" key={i}>
      <span className="sym">{t.sym}</span>
      <span className={"px tnum " + ((t.chg ?? 0) >= 0 ? "up" : "down")}>{t.px}</span>
      <span className={"chg tnum " + ((t.chg ?? 0) >= 0 ? "up" : "down")}>{(t.chg ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(t.chg ?? 0).toFixed(2)}%</span>
    </span>
  ));
  return <div className="ticker" aria-hidden="true"><div className="ticker-track">{row}{row}</div></div>;
}

/* ---------- theme toggle ---------- */
function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  const dark = theme === "dark";
  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title={dark ? "Switch to light" : "Switch to dark"}>
      <span className="ico sun">☀️</span><span className="ico moon">🌙</span>
      <motion.span className="knob" animate={{ left: dark ? 2 : 34 }} transition={{ type: "spring", stiffness: 500, damping: 32 }}>
        <motion.span animate={{ rotate: dark ? 0 : 180 }} transition={{ duration: 0.4 }}>{dark ? "🌙" : "☀️"}</motion.span>
      </motion.span>
    </button>
  );
}

/* ---------- corner menu ---------- */
const MENU = [
  { h: "Trade", links: [["Live Terminal", "/trade", "Spot · Futures · DCA with live prices"], ["Markets", "/markets", "Top coins, real-time stats"], ["Coin Analysis", "/markets", "Charts & detail for every coin"]] },
  { h: "Strategies", links: [["Step-by-step Guide", "/strategies", "Start from zero, safely"], ["DCA & Strategy Library", "/strategies", "Automate or trade manually"], ["Learn", "/learn", "Courses & glossary"]] },
  { h: "Account", links: [["Dashboard", "/dashboard", "Portfolio, P&L, activity"], ["Funding", "/funding", "Deposit, withdraw & history"], ["KYC Verification", "/dashboard?tab=kyc", "Identity verification"], ["Security", "/dashboard?tab=security", "2FA, password, sessions"], ["Fees", "/fees", "Platform fee schedule"]] },
  { h: "Company", links: [["About & Risk", "/about", "How the platform works"], ["Support", "/support", "Tickets, FAQ, contact"]] },
];

function CornerMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button className={"menu-btn" + (open ? " open" : "")} onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
        <span /><span /><span />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
            <div className="menu-grid">
              {MENU.map((col, i) => (
                <motion.div className="menu-col" key={col.h} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                  <h5>{col.h}</h5>
                  {col.links.map(([t, to, d]) => (
                    <Link key={t} to={to}>{t}<small>{d}</small></Link>
                  ))}
                </motion.div>
              ))}
            </div>
            <div className="menu-foot">
              <ThemeToggle />
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Live data: CoinGecko · Verified crypto funding</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- auth area ---------- */
function AuthArea() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  if (!user) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <Link className="btn btn-ghost" to="/login">Log In</Link>
        <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ display: "inline-flex" }}>
          <Link className="btn btn-primary" to="/signup">Sign Up</Link>
        </motion.span>
      </div>
    );
  }
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="avatar-btn" onClick={() => setOpen(!open)}>
        <span className="avatar">{initials}</span>
        <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name.split(" ")[0]}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="avatar-menu" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
            <div style={{ padding: "10px 12px 8px", fontSize: 12.5, color: "var(--muted)" }}>{user.email}</div>
            <div className="sep" />
            <Link to="/dashboard" onClick={() => setOpen(false)}>📊 Dashboard</Link>
            <Link to="/dashboard?tab=kyc" onClick={() => setOpen(false)}>🪪 KYC: <span className={"kyc-status kyc-" + (user.kyc.status === "verified" ? "verified" : user.kyc.status === "rejected" ? "rejected" : "none")} style={{ fontSize: 11 }}>{user.kyc.status}</span></Link>
            <Link to="/dashboard?tab=security" onClick={() => setOpen(false)}>🔐 Security</Link>
            <Link to="/dashboard?tab=settings" onClick={() => setOpen(false)}>⚙️ Settings</Link>
            {user.role === "admin" && <Link to="/admin" onClick={() => setOpen(false)}>🛠 Admin dashboard</Link>}
            <div className="sep" />
            <button onClick={async () => { setOpen(false); await logout(); nav("/"); }}>Log out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- notifications bell ---------- */
const KIND_ICON = { security: "🛡️", trades: "📈", alerts: "🔔", product: "📦" };
function NotifBell() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => api.notifications().then((r) => alive && setData(r)).catch(() => { });
    load();
    const iv = setInterval(load, 45000);
    return () => { alive = false; clearInterval(iv); };
  }, [user?.id]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  if (!user) return null;
  const unread = (data?.items || []).filter((n) => !n.read).length;
  const markAll = () => api.markNotifRead().then(() => setData((d) => d && ({ ...d, items: d.items.map((n) => ({ ...n, read: true })) }))).catch(() => { });
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="bell-btn" onClick={() => setOpen(!open)} aria-label="Notifications" title="Notifications">
        🔔{unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="bell-panel" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
            <div className="bp-head">
              <b>Notifications</b>
              {unread > 0 && <button onClick={markAll}>Mark all read</button>}
            </div>
            <div className="bp-list">
              {(data?.items || []).slice(0, 8).map((n) => (
                <div key={n.id} className={"notif" + (n.read ? "" : " unread")}>
                  <span className="n-ico">{KIND_ICON[n.kind] || "•"}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                    <small>{new Date(n.time).toLocaleString()}</small>
                  </div>
                </div>
              ))}
              {!(data?.items || []).length && <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications yet.</div>}
            </div>
            <Link className="bp-foot" to="/dashboard?tab=notifications" onClick={() => setOpen(false)}>Email & notification settings →</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- header ---------- */
const INLINE_LINKS = [
  ["Markets", "/markets"], ["Terminal", "/trade"], ["Strategies", "/strategies"], ["Learn", "/learn"],
];

function Header() {
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setCompact(v > 40));
  const loc = useLocation();
  return (
    <motion.header className={"site-header" + (compact ? " compact scrolled" : "")}>
      <div className="container nav-wrap">
        <Link className="logo" to="/"><Logo /><span>Vertex<span className="g">Trader</span></span></Link>
        <nav className="main-nav">
          {INLINE_LINKS.map(([label, to]) => (
            <div className="nav-item" key={to}>
              <NavLink to={to} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                {label}
                {loc.pathname === to && <motion.span className="nav-underline" layoutId="nav-under" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="nav-cta">
          <ThemeToggle />
          <NotifBell />
          <AuthArea />
          <CornerMenu />
        </div>
      </div>
    </motion.header>
  );
}

/* ---------- footer ---------- */
function Footer() {
  const col = (h, links) => (
    <div><h4>{h}</h4><ul>{links.map(([t, to]) => <li key={t}><Link to={to}>{t}</Link></li>)}</ul></div>
  );
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <Link className="logo" to="/"><Logo size={28} /><span>Vertex<span className="g">Trader</span></span></Link>
            <p>A crypto paper-trading platform with live CoinGecko market data: practise spot, futures and DCA strategies with virtual funds before ever risking real money.</p>
            <div className="socials">{["𝕏", "in", "▶", "◎"].map((s, i) => <motion.a key={i} href="#" whileHover={{ y: -3, rotate: 4 }} onClick={(e) => e.preventDefault()}>{s}</motion.a>)}</div>
          </div>
          {col("Trade", [["Live Terminal", "/trade"], ["Markets", "/markets"], ["Fee Schedule", "/fees"]])}
          {col("Learn", [["Getting Started Guide", "/strategies"], ["Strategy Library", "/strategies"], ["Courses & Glossary", "/learn"]])}
          {col("Account", [["Sign Up", "/signup"], ["Log In", "/login"], ["Dashboard", "/dashboard"], ["Funding", "/funding"], ["KYC Verification", "/dashboard?tab=kyc"], ["Notification Settings", "/dashboard?tab=notifications"]])}
          {col("Company", [["About & Risk", "/about"], ["Support & FAQ", "/support"], ["Share Feedback & Rate Us", "/support"], ["Trust & Transparency", "/#trust"]])}
        </div>
        <div className="risk-note">
          <p><strong>Risk warning:</strong> Cryptocurrency trading involves substantial risk and leveraged products can lead to rapid losses, including liquidation of your full margin. Prices can be extremely volatile. Nothing on this site is financial advice. Practise with virtual funds first and never risk money you cannot afford to lose.</p>
          <p><strong>Platform notice:</strong> Vertex Trader is a crypto trading platform. Market data is provided by CoinGecko's public API and may be delayed or rate-limited. Funding is crypto-only — every deposit and withdrawal is verified manually by our team before funds move. Trading involves substantial risk of loss; leveraged products can liquidate your entire margin. Nothing on this platform is financial advice.</p>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Vertex Trader · Market data by <a href="https://www.coingecko.com/" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>CoinGecko</a></span>
          <div className="legal">
            <Link to="/terms">Terms of Use</Link><Link to="/privacy">Privacy</Link><Link to="/fees">Fees</Link><Link to="/support">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- page transition shell ---------- */
export function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.21, 0.65, 0.36, 1] }}>
        {children}
      </motion.main>
    </AnimatePresence>
  );
}

export default function Layout({ children }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  useEffect(() => {
    const TITLES = {
      "/": "Vertex Trader — Crypto Trading with Live Market Data",
      "/markets": "Live Markets — Real CoinGecko Prices | Vertex Trader",
      "/trade": "Trading Terminal — Spot, Futures & DCA | Vertex Trader",
      "/strategies": "Step-by-Step Guide & Strategy Library | Vertex Trader",
      "/learn": "Courses & Glossary | Vertex Trader",
      "/funding": "Funding — Deposits & Withdrawals | Vertex Trader",
      "/fees": "Transparent Fee Schedule | Vertex Trader",
      "/about": "About & Risk Disclosure | Vertex Trader",
      "/support": "Support, FAQ & Tickets | Vertex Trader",
      "/signup": "Create Account | Vertex Trader",
      "/login": "Log In | Vertex Trader",
      "/dashboard": "Dashboard | Vertex Trader",
      "/admin": "Vertex Trader",
      "/terms": "Terms of Use | Vertex Trader",
      "/privacy": "Privacy Policy | Vertex Trader",
    };
    document.title = TITLES[pathname] || (pathname.startsWith("/coin/") ? "Coin Analysis | Vertex Trader" : "Vertex Trader");
  }, [pathname]);
  return (
    <>
      <div className="aurora" />
      <Announcement />
      <Ticker />
      <Header />
      <PageTransition>{children}</PageTransition>
      <Footer />
    </>
  );
}
