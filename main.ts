/* ============================================================
   Vertex Trader — Deno Deploy entrypoint
   Serves the built SPA from ./dist (commit the build: Deno Deploy
   does not run npm builds).

   The full API (auth, funding verification, admin, email) lives in
   server/index.js and needs a Node host (Render, Railway, Fly, VPS).
   Build the frontend with VITE_API_URL=https://your-api-host to point
   this deployment at it. Until then /api/* returns a clear 501 JSON
   and the site itself (markets, charts, terminal in demo mode) works.
   ============================================================ */

const DIST = new URL("./dist/", import.meta.url);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

async function tryFile(pathname: string): Promise<Uint8Array | null> {
  try {
    return await Deno.readFile(new URL("." + pathname, DIST));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    return json({
      error: "API host not configured. This Deno deployment serves the frontend only — run server/index.js on a Node host and rebuild the frontend with VITE_API_URL pointed at it.",
    }, 501);
  }

  if (pathname === "/") pathname = "/index.html";
  let data = await tryFile(pathname);
  if (!data && !pathname.includes(".")) {
    // SPA fallback: serve index.html AND adopt its identity so the response
    // is text/html (not octet-stream derived from the extensionless route).
    data = await tryFile("/index.html");
    if (data) pathname = "/index.html";
  }
  if (!data) return json({ error: "Not found." }, 404);

  const ext = pathname.slice(pathname.lastIndexOf("."));
  const headers: HeadersInit = {
    "content-type": TYPES[ext] ?? "application/octet-stream",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
  };
  if (pathname.startsWith("/assets/")) headers["cache-control"] = "public, max-age=31536000, immutable";
  else if (pathname === "/index.html") headers["cache-control"] = "no-cache";

  return new Response(data, { status: 200, headers });
});
