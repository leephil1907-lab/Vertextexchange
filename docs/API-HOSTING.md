# Hosting the Vertex Trader API (so the deployed site is fully functional)

The Deno Deploy site (`main.ts` → static `dist/`) serves the frontend only.
Accounts, funding, KYC, tickets and the admin console need the **Node API**
(`server/index.js`, Express + JSON file storage) hosted somewhere, and the
frontend rebuilt to point at it.

## 1. Host the API

Any Node 18+ host works. The repo ships a `render.yaml` blueprint for Render.

**Render**
1. New → Blueprint → pick this repo (it reads `render.yaml`), or create a plain
   Web Service: build `npm install && npm run build`, start `npm start`.
2. Set env vars in the dashboard:
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — initial admin account (created on first boot)
   - `CORS_ORIGIN` — your Deno Deploy URL, e.g. `https://vertextexchange-e5mt8dqxf6r4.leephil1907-lab.deno.net`
   - `APP_URL` — the API's own public URL (used in email links)
   - Optional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
     — without SMTP the outbox queues emails honestly (visible/resendable in Admin → Email).

**⚠ Storage caveat (important, honest):** the API persists to `server/data.json`.
- Render **free tier = ephemeral disk** → data resets on every redeploy/restart. Fine for demos.
- For real usage: paid instance + persistent disk, a VPS, Fly.io with a volume, or Railway with a volume.

## 2. Point the frontend at the API and rebuild

```bash
VITE_API_URL=https://<your-api-host> npm run build
git add dist && git commit -m "frontend → hosted API" && git push
```

(`src/services/api.js` reads `import.meta.env.VITE_API_URL`; empty = same-origin,
which is what the local Express server uses.)

## 3. Deno Deploy checklist

1. Dashboard → your project → Settings → **Entrypoint = `main.ts`** (this was the cause of the earlier HTTP 500).
2. Redeploy after each push (automatic if connected to GitHub).
3. Hard-refresh once after a deploy (old cached responses).

## 4. Verify

- `curl https://<api-host>/api/config` → JSON with announcement + 8 crypto payment methods
- `curl -o /dev/null -w "%{http_code}" https://<deno-url>/trade` → `200`, `content-type: text/html`
- On the site: sign up → dashboard → funding → admin console all work against the hosted API.
