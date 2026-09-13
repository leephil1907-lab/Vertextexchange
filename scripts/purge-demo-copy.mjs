/* Scope 17: strip demo/mock/paper/virtual copy everywhere EXCEPT the trading session
   (Trade.jsx LIVE/DEMO toggle + its banner/reset, Funding engine comments, Legal terms
   sentence that factually scopes demo to the terminal). */
import { readFileSync, writeFileSync } from "node:fs";
const fails = [];
function edit(file, pairs) {
  const p = new URL("../" + file, import.meta.url).pathname;
  let s = readFileSync(p, "utf8");
  for (const [old, nw] of pairs) {
    if (!s.includes(old)) { fails.push(file + " :: " + old.slice(0, 90)); continue; }
    s = s.replace(old, nw);
  }
  writeFileSync(p, s);
}

edit("src/components/Layout.jsx", [
  [` — with crypto funding verified manually by our team, and a demo mode in the terminal to practise risk-free.</p>`,
   ` — with crypto funding verified manually by our team.</p>`],
  [`Nothing on this site is financial advice. Use the terminal's demo mode to practise first and never risk money you cannot afford to lose.</p>`,
   `Nothing on this site is financial advice. Start small, manage risk on every position, and never risk money you cannot afford to lose.</p>`],
]);

edit("src/pages/About.jsx", [
  [`{ icon: "🎯", h: "Learn without burning capital", p: "Most new traders lose money in their first year — usually to leverage and emotions, not bad ideas. The terminal's demo session gives you separate practice funds at the same live prices, so those mistakes cost nothing." },`,
   `{ icon: "🎯", h: "Learn before you size up", p: "Most new traders lose money in their first year — usually to leverage and emotions, not bad ideas. Structured courses, a strategy library and live analysis pages let you build your edge on real market data before you commit serious capital." },`],
  [`            <p style={{ fontSize: 16, marginBottom: 14 }}>
              <b>Demo mode lives in the terminal only:</b> a LIVE/DEMO switch gives you separate practice funds at the same live prices, so you can learn the mechanics without touching your balance.
            </p>
`, ``],
  [`Nothing on this platform constitutes financial advice. Practise here first — and if you ever trade with real money elsewhere, do so only with funds you can afford to lose.</p>`,
   `Nothing on this platform constitutes financial advice. Start small, manage risk on every position, and never trade with money you cannot afford to lose.</p>`],
]);

edit("src/pages/Auth.jsx", [
  [`<p>Your account keeps your virtual wallet, open orders, DCA bots and performance history — on this device, tied to your login.</p>`,
   `<p>Your account keeps your wallet, open orders, DCA bots and performance history — tied to your login.</p>`],
]);

edit("src/pages/Learn.jsx", [
  [`  ["Demo mode", "A practice session inside the terminal with separate demo funds at the same live prices — switched via the LIVE/DEMO toggle."],\n`, ``],
]);

edit("src/pages/Legal.jsx", [
  [`theme, display currency, guest paper wallets, chart caches`, `theme, display currency, guest trading wallets, chart caches`],
]);

edit("src/pages/Support.jsx", [
  [`— spot, futures with real liquidation math, swaps and DCA bots. A demo session with separate practice funds is available in the terminal via the LIVE/DEMO switch."],`,
   `— spot, futures with real liquidation math, swaps and DCA bots."],`],
  [`["Do I need an account?", "You can explore the terminal's demo session as a guest — it's stored on this device. An account is required for funding, KYC, 2FA, login history and cross-session tracking."],`,
   `["Do I need an account?", "You can explore live markets and the terminal as a guest on this device. An account is required for funding, KYC, 2FA, login history and cross-session tracking."],`],
]);

edit("src/pages/CoinDetail.jsx", [
  [`<h3>Trade {coin.symbol?.toUpperCase()} (paper)</h3>`, `<h3>Trade {coin.symbol?.toUpperCase()}</h3>`],
]);

edit("src/pages/Dashboard.jsx", [
  [`paper.reset(); }}>Reset virtual wallet</button>`, `paper.reset(); }}>Reset wallet data</button>`],
  [`Your local paper wallet stays on this device until reset.`, `Your local wallet data stays on this device until reset.`],
]);

edit("src/pages/Strategies.jsx", [
  [`Every strategy can lose money in real markets; that's precisely why the terminal includes a demo mode to practise in first.`,
   `Every strategy can lose money in real markets; that's precisely why risk management matters on every position.`],
]);

edit("server/index.js", [
  [`"Your account was created successfully. The terminal's demo mode starts with 50,000 " + u.currency + " in virtual funds so you can practise; live trading uses your verified crypto balance. Enable two-factor authentication from Dashboard → Security."`,
   `"Your account was created successfully. Explore live markets from the terminal, fund your wallet with crypto whenever you're ready, and enable two-factor authentication from Dashboard → Security."`],
  [`refund to the paper wallet.`, `refund to the trading wallet.`],
  [`credited to your paper wallet`, `credited to your wallet`],
]);

edit("src/pages/Home.jsx", [
  [`<div className="cta-fine">No deposit needed to explore · Demo mode available in the terminal</div>`,
   `<div className="cta-fine">Free account · No deposit needed to explore live markets{!user && <> · Already trading? <Link to="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>Log in</Link></>}</div>`],
]);

if (fails.length) { console.error("PURGE FAILED:\n" + fails.join("\n")); process.exit(1); }
console.log("purge OK");
