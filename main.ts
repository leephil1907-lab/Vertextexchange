/* ============================================================
   Vertex Trader — Deno Deploy entrypoint
   Serves the built SPA from ./dist (commit the build: Deno Deploy
   does not run npm builds).

   Hard rules enforced here (the "never download a page" contract):
   1. Browser navigations (GET/HEAD with Accept: text/html, or any
      extensionless path) ALWAYS receive index.html as
      text/html; charset=utf-8 with Cache-Control: no-store.
   2. application/octet-stream is never sent for a navigation.
   3. Real files are served with an explicit MIME type; anything
      unmapped and non-navigational 404s as JSON.

   The full API (auth, funding verification, admin, email) lives in
   server/index.js and needs a Node host (Render, Railway, Fly, VPS).
   Build the frontend with VITE_API_URL=https://your-api-host to point
   this deployment at it. Until then /api/* returns a clear 501 JSON
   and the site itself (markets, charts, terminal) works.
   ============================================================ */

const DIST = new URL("./dist/", import.meta.url);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });

async function tryFile(pathname: string): Promise<Uint8Array | null> {
  try {
    return await Deno.readFile(new URL("." + pathname, DIST));
  } catch {
    return null;
  }
}

function isNavigation(req: Request, pathname: string): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!pathname.includes(".")) return true; // route like /trade or /coin/bitcoin
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return json({ error: "Bad path." }, 400);
  }

  if (pathname.startsWith("/api/")) {
    return json({
      error: "API host not configured. This Deno deployment serves the frontend only — run server/index.js on a Node host and rebuild the frontend with VITE_API_URL pointed at it.",
    }, 501);
  }

  // ---- SPA fallback: every navigation gets the real index.html as text/html ----
  if (pathname === "/" || isNavigation(req, pathname)) {
    if (pathname === "/" || !(await tryFile(pathname))) {
      const html = await tryFile("/index.html");
      if (html) {
        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store", // never let a browser/CDN freeze this response
            "x-content-type-options": "nosniff",
            "referrer-policy": "strict-origin-when-cross-origin",
          },
        });
      }
    }
  }

  // ---- static files from ./dist ----
  const data = await tryFile(pathname);
  if (!data) return json({ error: "Not found." }, 404);

  const dot = pathname.lastIndexOf(".");
  const ext = dot === -1 ? "" : pathname.slice(dot).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    // Unmapped extension: never octet-stream a page context — 404 as JSON.
    return json({ error: "Not found." }, 404);
  }

  const headers: HeadersInit = {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
  };
  if (pathname.startsWith("/assets/")) {
    headers["cache-control"] = "public, max-age=31536000, immutable";
  } else {
    headers["cache-control"] = "no-cache";
  }

  return new Response(data, { status: 200, headers });
});
