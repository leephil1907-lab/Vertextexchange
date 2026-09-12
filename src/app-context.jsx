/* App-wide context: theme (dark/light), auth session, display currency. */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./services/api.js";
import { paper } from "./engine/paper.js";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const THEME_KEY = "vt_theme_v1";
const FIAT_KEY = "vt_fiat_v1";
const MODE_KEY = "vt_session_mode_v1";

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [fiat, setFiatState] = useState(() => localStorage.getItem(FIAT_KEY) || "EUR");
  const [sessionMode, setSessionModeState] = useState(() => (localStorage.getItem(MODE_KEY) === "demo" ? "demo" : "live"));

  /* apply theme */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      if (getToken()) api.updateMe({ theme: next }).catch(() => { });
      return next;
    });
  }, []);

  /* restore session */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api.me();
          if (alive) {
            setUser(user);
            if (user.theme) setTheme(user.theme);
            if (user.currency) { setFiatState(user.currency); localStorage.setItem(FIAT_KEY, user.currency); }
          }
        } catch (e) { setToken(null); }
      }
      if (alive) setAuthLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  /* bind trading engine to identity + session mode (live | demo) */
  useEffect(() => {
    if (authLoading) return;
    paper.init(user ? user.id : "guest", sessionMode);
    paper.setFiat(fiat);
  }, [authLoading, user, sessionMode]);

  const setSessionMode = useCallback((m) => {
    const mode = m === "demo" ? "demo" : "live";
    setSessionModeState(mode);
    localStorage.setItem(MODE_KEY, mode);
    paper.init(user ? user.id : "guest", mode);
    paper.setFiat(fiat);
  }, [user, fiat]);

  /* forward trading events to the account's notification pipeline */
  useEffect(() => {
    if (!user) return;
    let lastId = Math.max(0, ...((paper.state?.history || []).map((h) => h.id || 0)));
    const mapEvent = (h) => {
      const sym = paper.meta(h.coinId || "")?.symbol || "";
      const fmt = (n) => Number(n).toPrecision(6);
      switch (h.kind) {
        case "spot": return [`Spot ${h.side} filled · ${sym}`, `${fmt(h.qty)} ${sym} @ ${fmt(h.price)} ${h.fiat} (fee ${h.fee?.toFixed(2)} ${h.fiat}).`];
        case "futures-open": return [`${String(h.side).toUpperCase()} ${h.leverage}x opened · ${sym}`, `${fmt(h.qty)} ${sym} @ ${fmt(h.price)} · margin ${h.margin?.toFixed(2)} ${h.fiat}.`];
        case "futures-close": return [`Position closed · ${sym}`, `Realised P&L ${h.pnl >= 0 ? "+" : ""}${h.pnl?.toFixed(2)} ${h.fiat} @ ${fmt(h.price)}.`];
        case "liquidation": return [`⚠ Position LIQUIDATED · ${sym}`, `Margin of ${h.margin?.toFixed(2)} ${h.fiat} lost at mark price ${fmt(h.price)}.`];
        case "dca": return [`DCA buy executed · ${sym}`, `${fmt(h.qty)} ${sym} @ ${fmt(h.price)} ${h.fiat}.`];
        case "dca-tp": return [`🎯 DCA take-profit hit · ${sym}`, `Sold ${fmt(h.qty)} ${sym} @ ${fmt(h.price)} ${h.fiat}.`];
        case "swap": return ["Swap completed", `Swapped ${fmt(h.qty)} at rate ${fmt(h.price)}.`];
        case "alert": return [`🔔 Price alert · ${sym}`, `${sym} is ${h.side} ${fmt(h.price)} ${h.fiat} (live price now ${fmt(h.price)}).`];
        default: return null;
      }
    };
    return paper.subscribe(() => {
      const hist = paper.state?.history || [];
      const fresh = hist.filter((h) => (h.id || 0) > lastId);
      if (!fresh.length) return;
      lastId = Math.max(lastId, ...fresh.map((h) => h.id || 0));
      fresh.slice(0, 6).reverse().forEach((h) => {
        const mapped = mapEvent(h);
        if (!mapped) return;
        api.notifyEvent(h.kind === "alert" ? "alerts" : "trades", mapped[0], mapped[1]).catch(() => { });
      });
    });
  }, [user?.id]);

  const setFiat = useCallback((f) => {
    setFiatState(f);
    localStorage.setItem(FIAT_KEY, f);
    paper.setFiat(f);
    if (getToken()) api.updateMe({ currency: f }).then(({ user }) => setUser(user)).catch(() => { });
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password);
    return r; // may be {need2FA, challenge}
  }, []);

  const finishLogin = useCallback((token, u) => {
    setToken(token);
    setUser(u);
    if (u.theme) setTheme(u.theme);
    if (u.currency) { setFiatState(u.currency); localStorage.setItem(FIAT_KEY, u.currency); }
  }, []);

  const signup = useCallback(async (name, email, password, currency) => {
    const r = await api.signup(name, email, password, currency);
    finishLogin(r.token, r.user);
    return r.user;
  }, [finishLogin]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch (e) { /* ignore */ }
    setToken(null);
    setUser(null);
    paper.init("guest");
    paper.setFiat(localStorage.getItem(FIAT_KEY) || "EUR");
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try { const { user } = await api.me(); setUser(user); } catch (e) { /* ignore */ }
  }, []);

  return (
    <AppCtx.Provider value={{ theme, toggleTheme, user, authLoading, login, finishLogin, signup, logout, refreshUser, fiat, setFiat, sessionMode, setSessionMode }}>
      {children}
    </AppCtx.Provider>
  );
}
