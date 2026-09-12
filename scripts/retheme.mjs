/* One-shot retheme: dark-first lime -> light-first navy/teal/cyan (Scope 16).
   Inverts :root (light) / [data-theme="dark"] and sweeps every hardcoded color. */
import { readFileSync, writeFileSync } from "node:fs";

const P = new URL("../src/styles.css", import.meta.url).pathname;
let css = readFileSync(P, "utf8");
const fails = [];

function rep(old, nw, all = false) {
  if (!css.includes(old)) { fails.push(old.slice(0, 90)); return; }
  css = all ? css.split(old).join(nw) : css.replace(old, nw);
}

/* ============ A. :root -> LIGHT palette ============ */
rep(`:root {
  --bg: #0b0d12;
  --bg-soft: #10131a;
  --bg-card: #151922;
  --bg-solid: #151922;
  --bg-elev: #1c2230;
  --line: #232a38;
  --line-strong: #39435a;
  --text: #f2f4f8;
  --muted: #9aa3b5;
  --faint: #646e85;
  --accent: #b8f229;
  --accent-2: #4f8cff;
  --up: #1fbf65;
  --down: #f2555b;
  --gold: #f5b840;
  --radius: 12px;
  --glass: saturate(130%) blur(14px);
  --shadow: 0 14px 40px rgba(0, 0, 0, .5);
  --glow-accent: 0 0 0 1px rgba(184, 242, 41, .4), 0 10px 30px rgba(184, 242, 41, .12);
  --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
}`, `:root {
  --bg: #f4f8fb;
  --bg-soft: #eaf1f8;
  --bg-card: #ffffff;
  --bg-solid: #ffffff;
  --bg-elev: #e9f0f8;
  --line: rgba(16, 42, 84, .1);
  --line-strong: rgba(16, 42, 84, .22);
  --text: #16233d;
  --muted: #4a5b78;
  --faint: #7c8aa5;
  --accent: #009e91;
  --accent-2: #204080;
  --accent-3: #43dde6;
  --up: #0ca678;
  --down: #e5484d;
  --gold: #f59e0b;
  --radius: 12px;
  --glass: saturate(130%) blur(14px);
  --shadow: 0 16px 44px rgba(28, 50, 120, .12);
  --shadow-sm: 0 6px 18px rgba(28, 50, 120, .08);
  --glow-accent: 0 0 0 1px rgba(0, 158, 145, .35), 0 10px 30px rgba(0, 158, 145, .12);
  --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
}`);

/* ============ B. old light token block -> DARK navy tokens ============ */
rep(`[data-theme="light"] {
  --bg: #f6f8ff;
  --bg-soft: #edf1fc;
  --bg-card: rgba(255, 255, 255, .92);
  --bg-solid: #ffffff;
  --bg-elev: #eef2fb;
  --line: rgba(18, 40, 95, .1);
  --line-strong: rgba(18, 40, 95, .24);
  --text: #0a142e;
  --muted: #46567a;
  --faint: #7e8ca9;
  --accent: #00b39b;
  --accent-2: #0084ff;
  --accent-3: #7c5cff;
  --up: #00a884;
  --down: #f43f5e;
  --gold: #f59e0b;
  --shadow: 0 16px 44px rgba(28, 50, 120, .14);
}`, `[data-theme="dark"] {
  --bg: #0a1220;
  --bg-soft: #0d1729;
  --bg-card: #111d36;
  --bg-solid: #111d36;
  --bg-elev: #1a2a4d;
  --line: rgba(140, 170, 220, .13);
  --line-strong: rgba(140, 170, 220, .26);
  --text: #eef3fb;
  --muted: #9db0cc;
  --faint: #66789c;
  --accent: #43dde6;
  --accent-2: #6d9bff;
  --accent-3: #00bfae;
  --up: #23c483;
  --down: #ff6b71;
  --gold: #f5b840;
  --shadow: 0 16px 44px rgba(0, 0, 0, .45);
  --shadow-sm: 0 6px 18px rgba(0, 0, 0, .35);
  --glow-accent: 0 0 0 1px rgba(67, 221, 230, .35), 0 10px 30px rgba(67, 221, 230, .12);
}`);

/* ============ C. old light patches -> dark patches ============ */
rep(`[data-theme="light"] body { color: var(--text); }
[data-theme="light"] .site-header { background: rgba(246, 248, 255, .86); }
[data-theme="light"] .ticker { background: #e8edfb; }
[data-theme="light"] .aurora::before { background: radial-gradient(closest-side, rgba(0, 132, 255, .16), transparent); }
[data-theme="light"] .aurora::after { background: radial-gradient(closest-side, rgba(184, 242, 41, .14), transparent); }
[data-theme="light"] .term-input, [data-theme="light"] .field input,
[data-theme="light"] .field select, [data-theme="light"] .field textarea { background: #fff; }
[data-theme="light"] .mega, [data-theme="light"] .pair-menu { background: rgba(255, 255, 255, .97); }
[data-theme="light"] .toast { background: #fff; }
[data-theme="light"] .grad-text { background: linear-gradient(92deg, #00b39b, #0084ff 55%, #7c5cff); -webkit-background-clip: text; background-clip: text; }
[data-theme="light"] .btn-primary { color: #fff; background: linear-gradient(100deg, #00b39b, #0084ff); box-shadow: 0 10px 26px rgba(0, 132, 255, .28); }
[data-theme="light"] .btn-primary:hover { box-shadow: 0 14px 34px rgba(0, 132, 255, .38); }
[data-theme="light"] .eyebrow { background: rgba(184, 242, 41, .1); color: #00806e; }
[data-theme="light"] .section.alt { background: linear-gradient(180deg, #eef4ff 0%, #f2fbf7 100%); }
[data-theme="light"] .card { box-shadow: 0 10px 30px rgba(28, 50, 120, .08); }
[data-theme="light"] .stat-cell, [data-theme="light"] .stat-card { background: #fff; }
[data-theme="light"] .site-footer { background: #0b1430; }
[data-theme="light"] .announce { background: linear-gradient(90deg, rgba(184, 242, 41, .14), rgba(0, 132, 255, .14), rgba(124, 92, 255, .14)); }`, `[data-theme="dark"] body { color: var(--text); }
[data-theme="dark"] .site-header { background: rgba(9, 16, 30, .85); }
[data-theme="dark"] .ticker { background: rgba(7, 13, 25, .85); }
[data-theme="dark"] .aurora::before { background: radial-gradient(closest-side, rgba(67, 221, 230, .1), transparent); }
[data-theme="dark"] .aurora::after { background: radial-gradient(closest-side, rgba(43, 82, 158, .22), transparent); }
[data-theme="dark"] .term-input, [data-theme="dark"] .field input,
[data-theme="dark"] .field select, [data-theme="dark"] .field textarea { background: rgba(6, 12, 24, .55); }
[data-theme="dark"] .pair-menu input { background: rgba(6, 12, 24, .55); }
[data-theme="dark"] .mega, [data-theme="dark"] .pair-menu { background: rgba(14, 24, 44, .96); }
[data-theme="dark"] .toast { background: rgba(14, 24, 44, .96); }
[data-theme="dark"] .mobile-drawer { background: rgba(7, 13, 25, .97); }
[data-theme="dark"] .chart-legend { background: rgba(7, 13, 25, .75); }
[data-theme="dark"] .grad-text { background: linear-gradient(92deg, #43dde6, #6d9bff 55%, #00bfae); -webkit-background-clip: text; background-clip: text; }
[data-theme="dark"] .btn-primary { color: #04222e; background: linear-gradient(135deg, #00d0bd, #5ce4ec); box-shadow: 0 8px 26px rgba(0, 208, 189, .25); }
[data-theme="dark"] .btn-primary:hover { box-shadow: 0 12px 32px rgba(0, 208, 189, .38); }
[data-theme="dark"] .btn-primary:disabled { background: #223450; color: #66789c; box-shadow: none; }
[data-theme="dark"] .eyebrow { background: rgba(67, 221, 230, .1); border-color: rgba(67, 221, 230, .35); color: var(--accent); }
[data-theme="dark"] .section.alt, [data-theme="dark"] .section-alt { background: linear-gradient(180deg, rgba(9, 16, 30, .55), rgba(9, 16, 30, .88)); }
[data-theme="dark"] .card { box-shadow: 0 10px 30px rgba(0, 0, 0, .35); }
[data-theme="dark"] .stat-cell, [data-theme="dark"] .stat-card { background: #111d36; }
[data-theme="dark"] .site-footer { background: #07101f; }
[data-theme="dark"] .announce { background: linear-gradient(90deg, rgba(0, 191, 174, .14), rgba(67, 221, 230, .1), rgba(109, 155, 255, .14)); }
[data-theme="dark"] ::selection { background: rgba(67, 221, 230, .3); color: #04222e; }`);

/* ============ D-H. stray light-theme patches -> dark equivalents ============ */
rep(`[data-theme="light"] .hero-live-card { background: rgba(255,255,255,.92); }`,
    `[data-theme="dark"] .hero-live-card { background: rgba(8,12,24,.84); }`);
rep(`[data-theme="light"] .bg-scrim { background: linear-gradient(180deg, rgba(10,16,32,.78), rgba(10,16,32,.87)); }\n`, ``);
rep(`:root { --accent-3: #7c5cff; }\n`, ``);
rep(`[data-theme="light"] .blob.b1 { background: rgba(184, 242, 41, .22); }
[data-theme="light"] .blob.b2 { background: rgba(0, 132, 255, .18); }
[data-theme="light"] .blob.b3 { background: rgba(124, 92, 255, .16); }`, `[data-theme="dark"] .blob.b1 { background: rgba(0, 191, 174, .16); }
[data-theme="dark"] .blob.b2 { background: rgba(109, 155, 255, .14); }
[data-theme="dark"] .blob.b3 { background: rgba(67, 221, 230, .12); }`);
rep(`[data-theme="light"] .float-chip { background: rgba(255, 255, 255, .92); }
[data-theme="light"] .float-chip b { color: var(--text); }`, `[data-theme="dark"] .float-chip { background: rgba(8, 12, 24, .8); }
[data-theme="dark"] .float-chip b { color: #fff; }`);

/* ============ I. v10 block rewrite ============ */
rep(`/* ===== v10: pro dark exchange theme — high-contrast, flat, original ===== */
.btn-primary { background: #b8f229; color: #0b0d12; box-shadow: 0 6px 22px rgba(184, 242, 41, .2); }
.btn-primary:hover { background: #c9ff4e; box-shadow: 0 8px 28px rgba(184, 242, 41, .3); }
.btn-primary:disabled { background: #3a4430; color: #77806a; box-shadow: none; }
.btn-buy { background: var(--up); color: #fff; }
.btn-buy:hover { filter: brightness(1.12); }
.btn-sell { background: var(--down); color: #fff; }
.btn-sell:hover { filter: brightness(1.12); }
.badge-pop { color: #b8f229; background: rgba(184, 242, 41, .12); }
.site-header { background: rgba(11, 13, 18, .92); }
.guide-num { color: #0b0d12; }
.mode-switch button.active.live { color: #b8f229; }
.mode-banner.live { background: rgba(184, 242, 41, .08); border-color: rgba(184, 242, 41, .3); color: #b8f229; }
.aurora::before { opacity: .5; }
.aurora::after { opacity: .45; }
::selection { background: rgba(184, 242, 41, .35); color: #fff; }`, `/* ===== v10 (rev. v12): light-first brand — navy / teal / cyan ===== */
.btn-primary { background: linear-gradient(135deg, #00bfae, #43dde6); color: #06283f; box-shadow: 0 6px 22px rgba(0, 191, 174, .28); }
.btn-primary:hover { filter: brightness(1.05); box-shadow: 0 10px 28px rgba(0, 191, 174, .38); }
.btn-primary:disabled { background: #c9d6e4; color: #7d8ba0; box-shadow: none; filter: none; }
.btn-buy { background: var(--up); color: #fff; }
.btn-buy:hover { filter: brightness(1.08); }
.btn-sell { background: var(--down); color: #fff; }
.btn-sell:hover { filter: brightness(1.08); }
.badge-pop { color: var(--accent); background: rgba(0, 191, 174, .12); border-color: rgba(0, 191, 174, .3); }
.site-header { background: rgba(255, 255, 255, .88); }
.guide-num { color: #fff; }
.mode-switch button.active.live { color: var(--accent); }
.mode-banner.live { background: rgba(0, 191, 174, .08); border-color: rgba(0, 191, 174, .3); color: var(--accent); }
.aurora::before { opacity: .55; }
.aurora::after { opacity: .5; }
::selection { background: rgba(0, 191, 174, .28); color: #0a2540; }`);

/* ============ J. specific rule fixes ============ */
rep(`::selection { background: rgba(184, 242, 41, .35); }`, `::selection { background: rgba(0, 191, 174, .28); }`);
rep(`background: linear-gradient(92deg, var(--accent) 0%, #D8FB7E 40%, var(--accent-2) 90%);`, `background: linear-gradient(92deg, #204080 0%, #00a194 55%, #38cfd9 100%);`);
rep(`background: radial-gradient(closest-side, rgba(79, 140, 255, .16), transparent);`, `background: radial-gradient(closest-side, rgba(32, 64, 128, .1), transparent);`);
rep(`background: radial-gradient(closest-side, rgba(184, 242, 41, .1), transparent);`, `background: radial-gradient(closest-side, rgba(0, 191, 174, .12), transparent);`);
rep(`.ticker { background: rgba(3, 6, 12, .8);`, `.ticker { background: rgba(255, 255, 255, .9);`);
rep(`background: rgba(5, 8, 15, .72);`, `background: rgba(255, 255, 255, .8);`);
rep(`.site-header.scrolled { box-shadow: 0 10px 40px rgba(2, 6, 16, .5); }`, `.site-header.scrolled { box-shadow: 0 10px 40px rgba(28, 50, 120, .16); }`);
rep(`background: rgba(13, 21, 38, .92);`, `background: rgba(255, 255, 255, .96);`);
rep(`position: fixed; inset: 0; z-index: 200; background: rgba(5, 8, 15, .97);`, `position: fixed; inset: 0; z-index: 200; background: rgba(247, 250, 253, .98);`);
rep(`.btn-primary { background: linear-gradient(135deg, var(--accent), #8CC414); color: #0B0D12; box-shadow: 0 6px 24px rgba(184, 242, 41, .25); }`, `.btn-primary { background: linear-gradient(135deg, #00bfae, #43dde6); color: #06283f; box-shadow: 0 6px 24px rgba(0, 191, 174, .3); }`);
rep(`.btn-primary:hover { box-shadow: 0 10px 32px rgba(184, 242, 41, .4); }`, `.btn-primary:hover { box-shadow: 0 10px 32px rgba(0, 191, 174, .42); filter: brightness(1.04); }`);
rep(`.btn-ghost { border-color: var(--line-strong); color: var(--text); background: rgba(79, 140, 255, .04); }`, `.btn-ghost { border-color: var(--line-strong); color: var(--text); background: rgba(32, 64, 128, .04); }`);
rep(`box-shadow: 0 6px 24px rgba(79, 140, 255, .25); }`, `box-shadow: 0 6px 24px rgba(32, 64, 128, .22); }`);
rep(`.btn-buy { background: linear-gradient(135deg, var(--up), #8CC414); color: #0B0D12; }`, `.btn-buy { background: linear-gradient(135deg, var(--up), #37c792); color: #fff; }`);
rep(`background: rgba(184, 242, 41, .08); border: 1px solid rgba(184, 242, 41, .3);`, `background: rgba(0, 191, 174, .1); border: 1px solid rgba(0, 191, 174, .35);`);
rep(`@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(184,242,41,.5); } 50% { box-shadow: 0 0 0 6px rgba(184,242,41,0); } }`, `@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,191,174,.5); } 50% { box-shadow: 0 0 0 6px rgba(0,191,174,0); } }`);
rep(`background: linear-gradient(135deg, rgba(184, 242, 41, .15), rgba(79, 140, 255, .15));`, `background: linear-gradient(135deg, rgba(0, 191, 174, .14), rgba(32, 64, 128, .1));`);
rep(`.section-alt { background: linear-gradient(180deg, rgba(10, 17, 32, .6), rgba(10, 17, 32, .9));`, `.section-alt { background: linear-gradient(180deg, #eef4fa, #f8fbfd);`);
rep(`border-radius: 50%; background: rgba(184, 242, 41, .14); color: var(--accent);`, `border-radius: 50%; background: rgba(0, 191, 174, .12); color: var(--accent);`);
rep(`  border: 1px solid rgba(184, 242, 41, .3);\n}`, `  border: 1px solid rgba(0, 191, 174, .35);\n}`);
rep(`letter-spacing: .08em; background: rgba(79, 140, 255, .05); font-weight: 700; }`, `letter-spacing: .08em; background: rgba(32, 64, 128, .05); font-weight: 700; }`);
rep(`table.data tbody tr:hover { background: rgba(79, 140, 255, .05); }`, `table.data tbody tr:hover { background: rgba(32, 64, 128, .05); }`);
rep(`.badge-new { background: rgba(79, 140, 255, .14); color: var(--accent-2); border: 1px solid rgba(79, 140, 255, .3); }`, `.badge-new { background: rgba(32, 64, 128, .08); color: var(--accent-2); border: 1px solid rgba(32, 64, 128, .22); }`);
rep(`.badge-pop { background: rgba(184, 242, 41, .13); color: var(--accent); border: 1px solid rgba(184, 242, 41, .3); }`, `.badge-pop { background: rgba(0, 191, 174, .12); color: var(--accent); border: 1px solid rgba(0, 191, 174, .35); }`);
rep(`.tab-btn.active { color: #0B0D12; font-weight: 700; }`, `.tab-btn.active { color: #06283f; font-weight: 700; }`);
rep(`.tab-pill { position: absolute; inset: 0; border-radius: 999px; background: linear-gradient(135deg, var(--accent), #8CC414); z-index: -1; }`, `.tab-pill { position: absolute; inset: 0; border-radius: 999px; background: linear-gradient(135deg, #00bfae, #43dde6); z-index: -1; }`);
rep(`.plan.featured { border-color: rgba(184, 242, 41, .55); box-shadow: var(--glow-accent); }`, `.plan.featured { border-color: rgba(0, 191, 174, .5); box-shadow: var(--glow-accent); }`);
rep(`background: linear-gradient(135deg, var(--accent), #8CC414); color: #0B0D12;`, `background: linear-gradient(135deg, #00bfae, #43dde6); color: #06283f;`);
rep(`radial-gradient(500px 240px at 20% 0%, rgba(184, 242, 41, .14), transparent 65%),`, `radial-gradient(500px 240px at 20% 0%, rgba(0, 191, 174, .12), transparent 65%),`);
rep(`radial-gradient(500px 240px at 80% 100%, rgba(79, 140, 255, .14), transparent 65%),`, `radial-gradient(500px 240px at 80% 100%, rgba(32, 64, 128, .1), transparent 65%),`);
rep(`background: radial-gradient(640px 320px at 72% 0%, rgba(79, 140, 255, .1), transparent 65%); }`, `background: radial-gradient(640px 320px at 72% 0%, rgba(32, 64, 128, .07), transparent 65%); }`);
rep(`font-weight: 800; font-size: 15px; color: #0B0D12;`, `font-weight: 800; font-size: 15px; color: #fff;`);
rep(`box-shadow: 0 0 0 4px rgba(184, 242, 41, .18); }`, `box-shadow: 0 0 0 4px rgba(0, 191, 174, .18); }`);
rep(`background: linear-gradient(135deg, rgba(184,242,41,.1), rgba(79,140,255,.1));`, `background: linear-gradient(135deg, rgba(0,191,174,.1), rgba(32,64,128,.08));`);
rep(`width: 100%; background: rgba(5, 8, 15, .6); border: 1px solid var(--line); color: var(--text);\n  font: 400 15px var(--font);`, `width: 100%; background: #f2f7fb; border: 1px solid var(--line); color: var(--text);\n  font: 400 15px var(--font);`);
rep(`.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(184, 242, 41, .12); }`, `.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0, 191, 174, .15); }`);
rep(`.site-footer { background: rgba(3, 6, 12, .9);`, `.site-footer { background: #eaf1f8;`);
rep(`background: rgba(13, 21, 38, .96);`, `background: rgba(255, 255, 255, .97);`);
rep(`.pair-menu input { width: 100%; background: rgba(5, 8, 15, .6);`, `.pair-menu input { width: 100%; background: #f2f7fb;`);
rep(`.pitem:hover { background: rgba(79, 140, 255, .12); }`, `.pitem:hover { background: rgba(0, 191, 174, .09); }`);
rep(`.tf-group button.active { background: rgba(184, 242, 41, .12); color: var(--accent); }`, `.tf-group button.active { background: rgba(0, 191, 174, .13); color: var(--accent); }`);
rep(`background: rgba(5, 8, 15, .75); padding: 6px 11px;`, `background: rgba(255, 255, 255, .88); padding: 6px 11px;`);
rep(`.book-row.bid .depth { background: rgba(184, 242, 41, .12); }`, `.book-row.bid .depth { background: rgba(12, 166, 120, .13); }`);
rep(`.side-btns button.buy.active { background: rgba(184, 242, 41, .16);`, `.side-btns button.buy.active { background: rgba(12, 166, 120, .14);`);
rep(`.seg button.active { background: rgba(79, 140, 255, .18); color: var(--accent-2); }`, `.seg button.active { background: rgba(32, 64, 128, .12); color: var(--accent-2); }`);
rep(`.term-input { display: flex; align-items: center; background: rgba(5, 8, 15, .6);`, `.term-input { display: flex; align-items: center; background: #f2f7fb;`);
rep(`.term-input:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(184, 242, 41, .1); }`, `.term-input:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0, 191, 174, .18); }`);
rep(`.toast { background: rgba(13, 21, 38, .95);`, `.toast { background: rgba(255, 255, 255, .97);`);
rep(`.cancel-btn:hover { border-color: var(--down); background: rgba(255, 93, 115, .1); }`, `.cancel-btn:hover { border-color: var(--down); background: rgba(229, 72, 77, .1); }`);
rep(`background: linear-gradient(90deg, rgba(184, 242, 41, .14), rgba(79, 140, 255, .14));`, `background: linear-gradient(90deg, rgba(0, 191, 174, .12), rgba(32, 64, 128, .08), rgba(67, 221, 230, .12));`);
rep(`.menu-col a:hover { background: rgba(79, 140, 255, .1); }`, `.menu-col a:hover { background: rgba(0, 191, 174, .08); }`);
rep(`.avatar-menu a:hover, .avatar-menu button:hover { background: rgba(79, 140, 255, .1); }`, `.avatar-menu a:hover, .avatar-menu button:hover { background: rgba(0, 191, 174, .08); }`);
rep(`.mega a:hover { background: rgba(79, 140, 255, .1); }`, `.mega a:hover { background: rgba(0, 191, 174, .08); }`);
rep(`.cur-select button.active { background: rgba(184, 242, 41, .15); color: var(--accent); }`, `.cur-select button.active { background: rgba(0, 191, 174, .14); color: var(--accent); }`);
rep(`.auth-error { background: rgba(255, 93, 115, .1); border: 1px solid rgba(255, 93, 115, .35);`, `.auth-error { background: rgba(229, 72, 77, .08); border: 1px solid rgba(229, 72, 77, .3);`);
rep(`.auth-ok { background: rgba(184, 242, 41, .1); border: 1px solid rgba(184, 242, 41, .35);`, `.auth-ok { background: rgba(0, 191, 174, .1); border: 1px solid rgba(0, 191, 174, .35);`);
rep(`.kyc-verified { background: rgba(184, 242, 41, .14); color: var(--accent); }`, `.kyc-verified { background: rgba(12, 166, 120, .13); color: var(--up); }`);
rep(`background: rgba(184, 242, 41, .07); font-weight: 700; }`, `background: rgba(0, 191, 174, .08); font-weight: 700; }`);
rep(`.lev-group button.active { border-color: var(--accent); color: var(--accent); background: rgba(184, 242, 41, .1); }`, `.lev-group button.active { border-color: var(--accent); color: var(--accent); background: rgba(0, 191, 174, .1); }`);
rep(`font-size: 20px; font-weight: 900; color: #0B0D12;`, `font-size: 20px; font-weight: 900; color: #fff;`);
rep(`.chip-toggle.on { border-color: var(--accent); color: var(--accent); background: rgba(184, 242, 41, .1); }`, `.chip-toggle.on { border-color: var(--accent); color: var(--accent); background: rgba(0, 191, 174, .1); }`);
rep(`.notif.unread { background: rgba(79,140,255,.07); }`, `.notif.unread { background: rgba(32,64,128,.06); }`);
rep(`.switch.on { background: rgba(184,242,41,.25); border-color: var(--accent); }`, `.switch.on { background: rgba(0,191,174,.22); border-color: var(--accent); }`);
rep(`background: rgba(8,12,24,.84);`, `background: rgba(255,255,255,.9);`);
rep(`.hlc-chg.up { color: var(--accent); }`, `.hlc-chg.up { color: var(--up); }`);
rep(`border-radius: 14px; background: rgba(8, 12, 24, .8);`, `border-radius: 14px; background: rgba(255, 255, 255, .92);`);
rep(`.float-chip b { font-size: 15px; color: #fff; }`, `.float-chip b { font-size: 15px; color: var(--text); }`);
rep(`.card > form > textarea:focus, .card > textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(184, 242, 41, .12); }`, `.card > form > textarea:focus, .card > textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0, 191, 174, .15); }`);
rep(`background: linear-gradient(135deg, #00b39b, #0084ff, #7c5cff);`, `background: linear-gradient(135deg, #00bfae, #204080, #43dde6);`);
rep(`background: var(--accent); color: #0B0D12; font: 700 13px var(--font);`, `background: var(--accent); color: #fff; font: 700 13px var(--font);`);
rep(`box-shadow: 0 10px 26px rgba(0, 132, 255, .3), 0 0 0 6px var(--bg);`, `box-shadow: 0 10px 26px rgba(0, 191, 174, .35), 0 0 0 6px var(--bg);`);
rep(`.mc-chg.up { color: var(--up); background: rgba(0, 168, 132, .12); }`, `.mc-chg.up { color: var(--up); background: rgba(12, 166, 120, .12); }`);
rep(`.mc-chg.down { color: var(--down); background: rgba(244, 63, 94, .12); }`, `.mc-chg.down { color: var(--down); background: rgba(229, 72, 77, .12); }`);
rep(`.tm-btns .buy { background: linear-gradient(100deg, #00a884, #00b39b); }`, `.tm-btns .buy { background: linear-gradient(100deg, #0ca678, #00bfae); }`);
rep(`.tm-btns .sell { background: linear-gradient(100deg, #e0354f, #f43f5e); }`, `.tm-btns .sell { background: linear-gradient(100deg, #d63a40, #e5484d); }`);
rep(`.blob.b1 { width: 340px; height: 340px; background: rgba(184, 242, 41, .35);`, `.blob.b1 { width: 340px; height: 340px; background: rgba(0, 191, 174, .26);`);
rep(`background: rgba(0, 132, 255, .3); bottom: -60px;`, `background: rgba(32, 64, 128, .18); bottom: -60px;`);
rep(`.blob.b3 { width: 220px; height: 220px; background: rgba(124, 92, 255, .28);`, `.blob.b3 { width: 220px; height: 220px; background: rgba(67, 221, 230, .3);`);
rep(`border-color: var(--accent); background: rgba(184, 242, 41, .09);\n  transform: scale(1.012); box-shadow: 0 8px 26px rgba(184, 242, 41, .18);`, `border-color: var(--accent); background: rgba(0, 191, 174, .08);\n  transform: scale(1.012); box-shadow: 0 8px 26px rgba(0, 191, 174, .18);`);
rep(`.doc-thumb > button:hover { background: rgba(224, 69, 92, .12); }`, `.doc-thumb > button:hover { background: rgba(229, 72, 77, .12); }`);
rep(`box-shadow: 0 2px 9px rgba(184, 242, 41, .45);`, `box-shadow: 0 2px 9px rgba(0, 191, 174, .4);`, true);
rep(`.slider-row input[type=range]:focus-visible { box-shadow: 0 0 0 3px rgba(184, 242, 41, .3); }`, `.slider-row input[type=range]:focus-visible { box-shadow: 0 0 0 3px rgba(0, 191, 174, .25); }`);
rep(`border-color: #101828;`, `border-color: #0e1830;`, true);
rep(`.pct-chips button.active { border-color: var(--accent); color: var(--accent); background: rgba(184, 242, 41, .1); }`, `.pct-chips button.active { border-color: var(--accent); color: var(--accent); background: rgba(0, 191, 174, .1); }`);
rep(`box-shadow: 0 6px 20px rgba(184, 242, 41, .16);`, `box-shadow: 0 6px 20px rgba(0, 191, 174, .18);`);
rep(`color: var(--accent-2); background: rgba(79, 140, 255, .1); padding: 3px 8px;`, `color: var(--accent-2); background: rgba(32, 64, 128, .08); padding: 3px 8px;`);
rep(`font: 700 11px var(--font); color: var(--accent); background: rgba(184, 242, 41, .1);`, `font: 700 11px var(--font); color: var(--accent); background: rgba(0, 191, 174, .12);`);
rep(`.mode-banner.demo { background: rgba(79, 140, 255, .1); border: 1px solid rgba(79, 140, 255, .3);`, `.mode-banner.demo { background: rgba(32, 64, 128, .08); border: 1px solid rgba(32, 64, 128, .25);`);
rep(`rgba(245, 184, 64,`, `rgba(245, 158, 11,`, true);
rep(`.mock-bar i:nth-child(1) { background: #F2555B; }`, `.mock-bar i:nth-child(1) { background: var(--down); }`);

/* ============ K. family sweep for anything left ============ */
css = css
  .replace(/rgba\(184, ?242, ?41, ?([\d.]+)\)/g, "rgba(0, 191, 174, $1)")
  .replace(/rgba\(79, ?140, ?255, ?([\d.]+)\)/g, "rgba(32, 64, 128, $1)")
  .replace(/rgba\(0, ?132, ?255, ?([\d.]+)\)/g, "rgba(32, 64, 128, $1)")
  .replace(/rgba\(124, ?92, ?255, ?([\d.]+)\)/g, "rgba(67, 221, 230, $1)")
  .replace(/rgba\(255, ?93, ?115, ?([\d.]+)\)/g, "rgba(229, 72, 77, $1)")
  .replace(/#8CC414/g, "#43dde6").replace(/#D8FB7E/g, "#43dde6")
  .replace(/#b8f229/gi, "#00bfae").replace(/#c9ff4e/gi, "#00d3c0")
  .replace(/#7c5cff/gi, "#43dde6").replace(/#0B0D12/g, "#06283f");

/* ============ L. assertions: no dark-leftovers ============ */
for (const pat of [/184, ?242, ?41/, /b8f229/i, /8CC414/i, /D8FB7E/i, /c9ff4e/i, /7c5cff/i,
  /#0B0D12|#0b0d12/, /124, ?92, ?255/, /0, ?132, ?255/, /245, ?184, ?64/, /255, ?93, ?115/,
  /rgba\(5, ?8, ?15/, /rgba\(13, ?21, ?38/, /rgba\(3, ?6, ?12/,
  /data-theme="light"/, /#151922|#10131a|#1c2230|#232a38|#39435a|#f2f4f8|#9aa3b5|#646e85|#4f8cff|#1fbf65|#f2555b|#00b39b|#0084ff|#eef2fb|#f6f8ff|#edf1fc|#0a142e|#46567a|#7e8ca9|#e8edfb|#0b1430|#f2fbf7|#eef4ff|#00806e|#101828|#3a4430|#77806a/i]) {
  const m = css.match(pat);
  if (m) fails.push("LEFTOVER: " + m[0]);
}
/* intentional dark-theme-only values: exact counts */
const cnt = (re) => (css.match(re) || []).length;
if (cnt(/rgba\(8, ?12, ?24/g) !== 2) fails.push("rgba(8,12,24 count=" + cnt(/rgba\(8, ?12, ?24/g));
if (cnt(/#f5b840/gi) !== 1) fails.push("#f5b840 count=" + cnt(/#f5b840/gi));

if (fails.length) { console.error("FAILED:\n" + fails.join("\n")); process.exit(1); }
writeFileSync(P, css);
console.log("styles.css rethemed OK —", css.split("\n").length, "lines");
