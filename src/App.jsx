import { lazy, Suspense } from "react";
import React from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { AppProvider } from "./app-context.jsx";
import Layout from "./components/Layout.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Markets = lazy(() => import("./pages/Markets.jsx"));
const CoinDetail = lazy(() => import("./pages/CoinDetail.jsx"));
const Trade = lazy(() => import("./pages/Trade.jsx"));
const Strategies = lazy(() => import("./pages/Strategies.jsx"));
const Learn = lazy(() => import("./pages/Learn.jsx"));
const Fees = lazy(() => import("./pages/Fees.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Support = lazy(() => import("./pages/Support.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Funding = lazy(() => import("./pages/Funding.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Signup = lazy(() => import("./pages/Auth.jsx").then((m) => ({ default: m.Signup })));
const Login = lazy(() => import("./pages/Auth.jsx").then((m) => ({ default: m.Login })));
const Terms = lazy(() => import("./pages/Legal.jsx").then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import("./pages/Legal.jsx").then((m) => ({ default: m.Privacy })));

/* ---------- error boundary: never white-screen ---------- */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <section className="container" style={{ textAlign: "center", padding: "110px 20px" }}>
          <div style={{ fontSize: 60 }}>🧯</div>
          <h1 style={{ fontSize: 28, margin: "14px 0 8px" }}>Something broke on this page</h1>
          <p style={{ color: "var(--muted)", maxWidth: 520, margin: "0 auto 22px" }}>
            An unexpected error occurred while rendering. Your account, wallet and open positions are safe on the server — reloading usually fixes it.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => { this.setState({ err: null }); window.location.href = "/"; }}>Reload the app</button>
        </section>
      );
    }
    return this.props.children;
  }
}

const Fallback = () => (
  <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
    <div className="spinner" />
  </div>
);

function NotFound() {
  const candles = [
    { x: 30, body: 70, h: 30, wt: 58, wb: 108, up: true },
    { x: 62, body: 55, h: 34, wt: 44, wb: 100, up: true },
    { x: 94, body: 48, h: 26, wt: 40, wb: 88, up: false },
    { x: 126, body: 58, h: 30, wt: 46, wb: 98, up: true },
    { x: 158, body: 40, h: 32, wt: 30, wb: 84, up: true },
    { x: 190, body: 52, h: 28, wt: 42, wb: 92, up: false },
    { x: 222, body: 62, h: 26, wt: 52, wb: 100, up: false },
  ];
  return (
    <section className="nf-section">
      <div className="blob b2" aria-hidden="true" />
      <div className="container nf-wrap">
        <motion.div className="nf-chart" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <svg viewBox="0 0 320 150" aria-hidden="true">
            {candles.map((c, i) => (
              <motion.g key={i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.4, ease: "easeOut" }}>
                <line x1={c.x} y1={c.wt} x2={c.x} y2={c.wb} stroke={c.up ? "var(--up)" : "var(--down)"} strokeWidth="2" strokeLinecap="round" />
                <rect x={c.x - 6} y={c.body} width="12" height={c.h} rx="2.5" fill={c.up ? "var(--up)" : "var(--down)"} />
              </motion.g>
            ))}
            <motion.g
              initial={{ opacity: 0, y: -34, rotate: 0 }}
              animate={{ opacity: 1, y: 52, rotate: 12 }}
              transition={{ delay: 0.95, type: "spring", stiffness: 80, damping: 11 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <line x1="258" y1="52" x2="258" y2="98" stroke="var(--down)" strokeWidth="2" strokeLinecap="round" />
              <rect x="252" y="62" width="12" height="30" rx="2.5" fill="var(--down)" />
            </motion.g>
            <line x1="8" y1="120" x2="312" y2="120" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="5 5" />
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 }}>
              <rect x="266" y="112" width="46" height="16" rx="4" fill="var(--down)" />
              <text x="289" y="123.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">404.00</text>
            </motion.g>
          </svg>
          <span className="nf-tag">DELISTED</span>
        </motion.div>
        <div className="grad-text nf-code">404</div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>This market doesn't exist</motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          The page you're looking for was moved, delisted or never listed. Everything below is very much live.
        </motion.p>
        <motion.div className="nf-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Link className="btn btn-primary btn-lg" to="/">Back to home</Link>
          <Link className="btn btn-ghost btn-lg" to="/trade">Open terminal</Link>
          <Link className="btn btn-ghost btn-lg" to="/markets">Browse markets</Link>
        </motion.div>
        <motion.div className="nf-popular" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
          Popular: <Link to="/funding">Funding</Link> · <Link to="/learn">Learn</Link> · <Link to="/strategies">Strategies</Link> · <Link to="/support">Support</Link>
        </motion.div>
      </div>
    </section>
  );
}

export default function App() {
  const location = useLocation();
  return (
    <AppProvider>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<Fallback />}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/coin/:id" element={<CoinDetail />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/strategies" element={<Strategies />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/fees" element={<Fees />} />
              <Route path="/about" element={<About />} />
              <Route path="/support" element={<Support />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/funding" element={<Funding />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </AppProvider>
  );
}
