/* Scope-16 sweep: lime/dark-era literals -> navy/teal/cyan + honest copy fixes. */
import { readFileSync, writeFileSync } from "node:fs";
const fails = [];
function edit(file, pairs) {
  const p = new URL("../" + file, import.meta.url).pathname;
  let s = readFileSync(p, "utf8");
  for (const [old, nw, all] of pairs) {
    if (!s.includes(old)) { fails.push(file + " :: " + old.slice(0, 80)); continue; }
    s = all ? s.split(old).join(nw) : s.replace(old, nw);
  }
  writeFileSync(p, s);
}

edit("src/pages/Admin.jsx", [
  [`"#B8F229"`, `"#43DDE6"`, true],
  [`background: "#7CBF0F", color: "#fff"`, `background: "#00BFAE", color: "#06283f"`],
  [`rgba(184,242,41,.12)`, `rgba(0,191,174,.12)`],
]);

edit("src/pages/Auth.jsx", [
  [`const colors = ["#e0455c", "#e0455c", "#f5b840", "#f5b840", "#B8F229"];`, `const colors = ["#e5484d", "#e5484d", "#f59e0b", "#f59e0b", "#0ca678"];`],
]);

edit("src/pages/Dashboard.jsx", [
  [`"#B8F229" : "#F2555B"`, `"#0ca678" : "#e5484d"`, true],
  [`rgba(184,242,41,.25)" : "rgba(255,93,115,.25)`, `rgba(12,166,120,.22)" : "rgba(229,72,77,.22)`, true],
  [`rgba(184,242,41,0)`, `rgba(12,166,120,0)`],
]);

edit("src/pages/Strategies.jsx", [
  [`linear-gradient(135deg,#7CBF0F,#B8F229)`, `linear-gradient(135deg,#0ca678,#22c98d)`],
  [`Every strategy can lose money in real markets; that's precisely why you're practising with virtual funds.`, `Every strategy can lose money in real markets; that's precisely why the terminal includes a demo mode to practise in first.`],
]);

edit("src/pages/Support.jsx", [
  [`rgba(184,242,41,.12)`, `rgba(0,191,174,.12)`],
]);

edit("src/pages/Trade.jsx", [
  [`color: o.side === "buy" ? "#1FBF65" : "#F2555B"`, `color: o.side === "buy" ? "#0ca678" : "#e5484d"`],
  [`color: "#f5b840", style: "dotted"`, `color: "#f59e0b", style: "dotted"`],
  [`background: "rgba(79,140,255,.06)"`, `background: "var(--bg-elev)"`],
]);

edit("src/components/CandleChart.jsx", [
  [`dark: { text: "#8fa1c2", grid: "rgba(79,140,255,.07)", border: "rgba(79,140,255,.22)", labelBg: "#16223c" },`, `dark: { text: "#9db0cc", grid: "rgba(109,155,255,.08)", border: "rgba(109,155,255,.22)", labelBg: "#152542" },`],
  [`color: "#c084fc", lineWidth: 1.6`, `color: "#009e91", lineWidth: 1.6`],
  [`color: "rgba(184,242,41,.5)"`, `color: "rgba(31,191,101,.55)"`],
  [`"rgba(184,242,41,.28)" : "rgba(255,93,115,.28)"`, `"rgba(31,191,101,.3)" : "rgba(242,85,91,.3)"`],
  [`"rgba(184,242,41,.55)" : "rgba(255,93,115,.55)"`, `"rgba(31,191,101,.55)" : "rgba(242,85,91,.55)"`],
  [`"#4f8cff"`, `"#3a6fe0"`, true],
  [`"#f5b840"`, `"#f59e0b"`, true],
]);

edit("src/components/LiveScene.jsx", [
  [`"rgba(184,242,41,"`, `"rgba(0,191,174,"`, true],
  [`"rgba(140,90,255,"`, `"rgba(67,221,230,"`, true],
]);

edit("server/index.js", [
  [`<td style="border-radius:10px;background:#B8F229;">`, `<td style="border-radius:10px;background:#00BFAE;">`],
  [`border-radius:10px;color:#0B0D12;`, `border-radius:10px;color:#06283f;`],
  [`style="color:#B8F229;text-decoration:none;`, `style="color:#43DDE6;text-decoration:none;`],
  [`<span style="color:#B8F229;">&#9650;</span>`, `<span style="color:#43DDE6;">&#9650;</span>`],
  [`<div style="height:3px;border-radius:2px;background:#B8F229;"></div>`, `<div style="height:3px;border-radius:2px;background:#00BFAE;"></div>`],
  [`text-transform:uppercase;">Live market data · virtual funds</td>`, `text-transform:uppercase;">Live market data · crypto funding</td>`],
  [`Vertex Trader is a paper-trading platform — all trading uses virtual funds, no real assets are held and nothing here is financial advice.`, `Vertex Trader is a crypto trading platform — deposits and withdrawals are verified manually by our team, trading executes against live market prices, and nothing here is financial advice.`],
  [`: "Paper-trading platform · virtual funds only"}`, `: "Crypto trading platform · funding verified manually"}`],
  [`"Your account was created successfully. Your paper wallet starts with 50,000 " + u.currency + " in virtual funds. Enable two-factor authentication from Dashboard → Security."`, `"Your account was created successfully. The terminal's demo mode starts with 50,000 " + u.currency + " in virtual funds so you can practise; live trading uses your verified crypto balance. Enable two-factor authentication from Dashboard → Security."`],
]);

edit("index.html", [
  [`<meta name="theme-color" content="#0B0D12" />`, `<meta name="theme-color" content="#f4f8fb" />`],
  [`stroke='%23B8F229'`, `stroke='%23009e91'`],
  [`<circle cx='27.5' cy='6' r='3.5' fill='%234f8cff'/>`, `<circle cx='27.5' cy='6' r='3.5' fill='%2343dde6'/>`],
]);

if (fails.length) { console.error("SWEEP FAILED:\n" + fails.join("\n")); process.exit(1); }
console.log("sweep OK");
