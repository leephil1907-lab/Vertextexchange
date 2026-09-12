import { lazy, Suspense } from "react";
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
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
  return (
    <section className="container" style={{ textAlign: "center", padding: "120px 20px" }}>
      <div className="grad-text" style={{ fontSize: 84, fontWeight: 900, lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 28, margin: "14px 0 8px" }}>Page not found</h1>
      <p style={{ color: "var(--muted)", marginBottom: 26 }}>The page you're looking for doesn't exist or has moved.</p>
      <a className="btn btn-primary btn-lg" href="/">Back to home</a>
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
