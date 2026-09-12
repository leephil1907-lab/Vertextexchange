# Vertex Trader

A **crypto paper-trading platform** with live market data: practise spot, isolated-margin futures (with real liquidation math), swaps, DCA bots and price alerts against **real CoinGecko prices** — funded with **virtual funds only**. Full account stack included: scrypt-hashed passwords, token sessions, RFC-6238 TOTP two-factor auth, automated KYC validation, notification pipeline with branded HTML emails, conversation-style support tickets, funding ledger, and a hardened admin console.

> **Honest positioning.** This is not a broker or exchange. No real assets are held or traded, nothing here is financial advice, and verification outcomes carry no legal standing. Market data © CoinGecko (public API, attributed in-product). Charts render with TradingView Lightweight Charts (open source). All design, code and copy are original.

---

## Quick start

```bash
npm install

# terminal 1 — API (Express, :3001)
ADMIN_EMAIL=admin@vertextrader.app ADMIN_PASSWORD='your-strong-password' node server/index.js

# terminal 2 — frontend (Vite, :5173, proxies /api → :3001)
npm run dev
```

Open `http://localhost:5173`. The admin account is created on first start (credentials from env; a random password is printed to the console if `ADMIN_PASSWORD` is unset).

**Production:** one process serves everything.

```bash
npm run build          # → dist/
ADMIN_EMAIL=... ADMIN_PASSWORD=... PORT=3001 npm start
```

`server/index.js` detects `dist/` and serves the built SPA (with SPA fallback, immutable caching for hashed assets, `no-cache` for `index.html`) alongside the API on the same port — no separate static host or proxy needed. Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are applied to every response. Set `SMTP_*` env vars for real email delivery; otherwise mails queue to the admin outbox. `PORT` defaults to 3001.


## Environment

See `.env.example`. Key variables:

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST/PORT/USER/PASS/SECURE/FROM` | Real email delivery. **Unset = emails are honestly queued** in each user's outbox (never faked as sent). |
| `APP_URL` | Base URL used for links inside emails. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin bootstrap on first start. |

## Features

- **Live data** — CoinGecko `/coins/markets`, `/coins/{id}`, `/market_chart`, `/global`; throttled queue (1 req/1.3s), TTL cache + stale fallback with visible "cached/rate-limited" states.
- **Terminal** — candlesticks (6 timeframes) + EMA20/50, RSI & MACD panes (synced scales), spot market/limit orders, isolated-margin futures 1–50x with live ROE & auto-liquidation (`entry × (1 ∓ 1/lev ± 0.5%)`), swaps, DCA bots with take-profit, chart-plotted alerts & resting orders.
- **Paper engine** — 0.10% spot fee, 0.05% futures fee, 4 bps execution spread on real mids, per-owner wallets persisted in localStorage; equity snapshots → P&L curve.
- **Accounts & security** — scrypt + per-user salt, bearer sessions, TOTP 2FA (any authenticator app), login history, suspension, password reset via branded email token.
- **KYC** — automated rule validation (name/DOB/age/address/ID type/number/document image checks) with explicit rejection reasons and resubmission.
- **Notifications** — per-channel email settings (security / trades / alerts / product), in-app bell feed, trading-event forwarding, honest outbox with `queued | sending | sent | failed`.
- **Support** — tickets that are real conversations (user ↔ admin), status workflow, forced branded email on replies.
- **Funding** — virtual deposits/withdrawals across fiat wallets & top-50 coins. Every request is **verified manually by an admin** before funds move: deposits credit on approval; withdrawals hold funds immediately and auto-refund on rejection. Decisions fire in-app notifications + branded emails. Payment mechanics are unchanged — the wallet is virtual, no real money or payment processor is involved.
- **Admin (`/admin`, stealth 404 for non-admins)** — stats, email composer with live branded-template preview & broadcasts, ticket inbox, **funding verification queue (approve/reject with mandatory reason)**, user suspension/roles, site announcement manager, global outbox with resend.
- **Privacy rights** — JSON data export and password-confirmed account deletion.
- **UX** — bright vivid light theme (default) + dark theme, fully responsive (desktop → 320px), cinematic generated artwork plus a canvas "living image" hero animated by live prices, code-split routes, error boundary, per-route titles, reduced-motion & focus-visible support.

## API surface (abridged)

```
POST /api/auth/{signup,login,2fa/login,forgot,reset,password,logout}
POST /api/auth/2fa/{setup,verify,disable}
GET|PATCH /api/me · GET /api/me/export · DELETE /api/me
GET|POST /api/kyc
GET /api/notifications · PATCH /api/notifications/settings · POST /api/notifications/{read,event,test}
POST /api/support · GET /api/support/mine · POST /api/support/:id/reply
POST /api/funding/request · GET /api/funding/mine
GET /api/admin/funding?status= · POST /api/admin/funding/:id/decide {action: approve|reject, reason}
GET /api/config
GET /api/admin/{stats,users,tickets,outbox} · POST /api/admin/{email}
POST /api/admin/{tickets/:id/reply,tickets/:id/status,outbox/:id/resend,users/:id/role,users/:id/suspend}
PATCH /api/admin/config
```

All `/api/admin/*` routes require the admin role (403 otherwise); suspended accounts cannot authenticate; the last admin cannot be demoted, suspended or deleted.

## Tests

```bash
npm run test:api   # scripts/smoke.mjs — end-to-end backend assertions (server must be running)
```

Covers health, config, signup, sessions, notifications + queued mail, settings merge, KYC reject/verify, real TOTP 2FA, login challenge, ticket conversation, forgot-password no-leak, data export, admin guards, admin stats/outbox/ticket reply.

## Project layout

```
server/index.js        Express API + persistence (server/data.json)
src/engine/paper.js    paper-trading engine (wallets, orders, futures, DCA, alerts)
src/engine/indicators.js  EMA/RSI/MACD series
src/services/          api client, CoinGecko throttle/cache, candle builder
src/components/        Layout, CandleChart, LiveScene, Sparkline, ui kit
src/pages/             Home, Markets, CoinDetail, Trade, Strategies, Learn,
                       Fees, Funding, About, Support, Auth, Dashboard, Admin, Legal
scripts/smoke.mjs      backend smoke test
public/img/            generated cinematic artwork
```

## Licence

Private project — all rights reserved. Third-party services (CoinGecko, TradingView Lightweight Charts) remain property of their owners and are used under their respective terms with attribution.
