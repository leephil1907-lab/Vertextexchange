import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/* ============================================================
   MarketSphere — dependency-free 3D market visualization.
   Canvas 2D with perspective projection: wireframe globe, live
   price beams (real 24h changes), orbit ring, particle field,
   grid floor, mouse parallax + slow scroll tilt.
   Draws only when on-screen and the tab is visible.
   ============================================================ */

const BEAM_POS = [
  { lat: 34, lon: 20 }, { lat: -18, lon: 95 }, { lat: 48, lon: 200 }, { lat: -42, lon: 280 },
  { lat: 8, lon: 150 }, { lat: -30, lon: 330 }, { lat: 56, lon: 60 }, { lat: -8, lon: 240 },
];
const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;

export default function MarketSphere({ quotes = [], radius = 0.26, particles = 70, scrollTilt = true, className = "" }) {
  const ref = useRef(null);
  const qRef = useRef(quotes);
  qRef.current = quotes;
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, R = 0, cx = 0, cy = 0;
    let running = true, onScreen = true;

    const resize = () => {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) * radius;
      cx = W / 2; cy = H / 2;
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro && ro.observe(cv);

    /* pointer parallax */
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e) => {
      const r = cv.getBoundingClientRect();
      ptr.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ptr.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!reduced) window.addEventListener("mousemove", onMove, { passive: true });

    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { threshold: 0.02 })
      : null;
    io && io.observe(cv);
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    /* scene data */
    const fib = Array.from({ length: 140 }, (_, i) => {
      const yv = 1 - (i / 139) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - yv * yv));
      const th = i * 2.399963;
      return { x: Math.cos(th) * rr, y: yv, z: Math.sin(th) * rr, ph: Math.random() * TAU };
    });
    const parts = Array.from({ length: particles }, () => ({
      r: 1.15 + Math.random() * 0.95, sp: 0.08 + Math.random() * 0.42, inc: (Math.random() - 0.5) * 1.5,
      ph: Math.random() * TAU, sz: 0.5 + Math.random() * 1.4, c: Math.random(),
    }));

    let t = 0, raf = 0;
    const P = { x: 0, y: 0, z: 0 };
    const FOV = 2.7;

    const project = (x, y, z, rotX, rotY) => {
      /* rotate Y then X */
      let X = x * Math.cos(rotY) - z * Math.sin(rotY);
      let Z = x * Math.sin(rotY) + z * Math.cos(rotY);
      let Y = y * Math.cos(rotX) - Z * Math.sin(rotX);
      Z = y * Math.sin(rotX) + Z * Math.cos(rotX);
      const persp = FOV / (FOV + Z);
      P.x = cx + X * R * persp; P.y = cy + Y * R * persp; P.z = Z;
      return persp;
    };
    const depthA = (z, lo, hi) => lo + (hi - lo) * Math.min(1, Math.max(0, (z + 1) / 2));

    const draw = () => {
      if (!W || !H) return;
      const q = qRef.current || [];
      const rotY = reduced ? 0.6 : t * 0.22 + ptr.x * 0.22;
      const rotX = -0.16 + (reduced ? 0 : ptr.y * 0.16) + (scrollTilt ? Math.min(window.scrollY, 900) * 0.00032 : 0);
      ctx.clearRect(0, 0, W, H);

      /* core glow */
      const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.3);
      glow.addColorStop(0, "rgba(0, 191, 174, 0.12)");
      glow.addColorStop(0.45, "rgba(43, 82, 158, 0.08)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      /* grid floor */
      ctx.save();
      ctx.strokeStyle = "rgba(109, 155, 255, 0.07)";
      ctx.lineWidth = 1;
      const fy = cy + R * 1.42;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, fy, R * (0.75 + i * 0.42), R * (0.16 + i * 0.09), 0, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.75, fy + Math.sin(a) * R * 0.16);
        ctx.lineTo(cx + Math.cos(a) * R * 2.0, fy + Math.sin(a) * R * 0.43);
        ctx.stroke();
      }
      ctx.restore();

      /* wireframe: latitude rings */
      const seg = 72;
      for (const lat of [-60, -30, 0, 30, 60]) {
        const cl = Math.cos(rad(lat)), sl = Math.sin(rad(lat));
        let px0 = 0, py0 = 0, pz0 = 0, first = true;
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * TAU;
          project(cl * Math.cos(a), sl, cl * Math.sin(a), rotX, rotY);
          if (!first) {
            ctx.strokeStyle = `rgba(109, 155, 255, ${depthA((P.z + pz0) / 2, 0.05, 0.3).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(P.x, P.y); ctx.stroke();
          }
          px0 = P.x; py0 = P.y; pz0 = P.z; first = false;
        }
      }
      /* meridians */
      for (const lon of [0, 45, 90, 135]) {
        let px0 = 0, py0 = 0, pz0 = 0, first = true;
        for (let i = 0; i <= seg / 2; i++) {
          const u = -Math.PI / 2 + (i / (seg / 2)) * Math.PI;
          const cl = Math.cos(u);
          project(cl * Math.cos(rad(lon)), Math.sin(u), cl * Math.sin(rad(lon)), rotX, rotY);
          if (!first) {
            ctx.strokeStyle = `rgba(67, 221, 230, ${depthA((P.z + pz0) / 2, 0.04, 0.2).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(P.x, P.y); ctx.stroke();
          }
          px0 = P.x; py0 = P.y; pz0 = P.z; first = false;
        }
      }

      /* fibonacci point cloud */
      for (const f of fib) {
        project(f.x, f.y, f.z, rotX, rotY);
        const tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 1.7 + f.ph);
        const a = depthA(P.z, 0.08, 0.62) * tw;
        ctx.fillStyle = f.y > 0 ? `rgba(67, 221, 230, ${a.toFixed(3)})` : `rgba(157, 180, 255, ${a.toFixed(3)})`;
        const s = (0.7 + 1.1 * ((P.z + 1) / 2));
        ctx.beginPath(); ctx.arc(P.x, P.y, s, 0, TAU); ctx.fill();
      }

      /* live price beams (real 24h changes) */
      ctx.font = "700 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      q.slice(0, 8).forEach((c, i) => {
        if (c == null || typeof c.chg !== "number") return;
        const pos = BEAM_POS[i % BEAM_POS.length];
        const cl = Math.cos(rad(pos.lat));
        const nx = cl * Math.cos(rad(pos.lon)), ny = Math.sin(rad(pos.lat)), nz = cl * Math.sin(rad(pos.lon));
        const len = 0.16 + Math.min(Math.abs(c.chg), 12) / 12 * 0.5;
        project(nx * 1.01, ny * 1.01, nz * 1.01, rotX, rotY);
        const bx = P.x, by = P.y, bz = P.z;
        project(nx * (1.02 + len), ny * (1.02 + len), nz * (1.02 + len), rotX, rotY);
        const up = c.chg >= 0;
        const a = depthA(bz, 0.15, 0.95);
        if (a < 0.2) return;
        ctx.strokeStyle = up ? `rgba(35, 196, 131, ${a.toFixed(3)})` : `rgba(255, 107, 113, ${a.toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(P.x, P.y); ctx.stroke();
        /* tip glow + label */
        ctx.fillStyle = up ? `rgba(35, 196, 131, ${a.toFixed(3)})` : `rgba(255, 107, 113, ${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(P.x, P.y, 2.6, 0, TAU); ctx.fill();
        if (a > 0.45 && c.sym) {
          ctx.fillStyle = `rgba(238, 243, 251, ${(a * 0.92).toFixed(3)})`;
          ctx.fillText(`${c.sym} ${up ? "+" : ""}${c.chg.toFixed(1)}%`, P.x + 6, P.y - 4);
        }
      });

      /* orbit ring + travelling dot */
      {
        const tilt = rad(68), spin = rad(16);
        let px0 = 0, py0 = 0, first = true;
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * TAU;
          let x = Math.cos(a) * 1.55, z = Math.sin(a) * 1.55, y = 0;
          /* tilt around X then Z */
          let y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
          let z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
          let x2 = x * Math.cos(spin) - y2 * Math.sin(spin);
          y2 = x * Math.sin(spin) + y2 * Math.cos(spin);
          project(x2, y2, z2, rotX, rotY);
          if (!first) {
            ctx.strokeStyle = `rgba(67, 221, 230, ${depthA(P.z, 0.04, 0.22).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(P.x, P.y); ctx.stroke();
          }
          px0 = P.x; py0 = P.y; first = false;
        }
        const oa = reduced ? 1.2 : t * 0.5;
        let x = Math.cos(oa) * 1.55, z = Math.sin(oa) * 1.55, y = 0;
        let y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        let z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        let x2 = x * Math.cos(spin) - y2 * Math.sin(spin);
        y2 = x * Math.sin(spin) + y2 * Math.cos(spin);
        project(x2, y2, z2, rotX, rotY);
        const og = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 9);
        og.addColorStop(0, "rgba(67, 221, 230, 0.9)");
        og.addColorStop(1, "rgba(67, 221, 230, 0)");
        ctx.fillStyle = og;
        ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, TAU); ctx.fill();
      }

      /* particle field */
      for (const p2 of parts) {
        const a = reduced ? p2.ph : p2.ph + t * p2.sp * 0.35;
        const x = Math.cos(a) * p2.r;
        const z = Math.sin(a) * p2.r;
        const y = Math.sin(a * 0.7 + p2.ph) * p2.inc * 0.55;
        project(x, y, z, rotX, rotY);
        const al = depthA(P.z, 0.05, 0.5) * (reduced ? 0.7 : 0.6 + 0.4 * Math.sin(t * 1.3 + p2.ph));
        ctx.fillStyle = p2.c < 0.4 ? `rgba(67, 221, 230, ${al.toFixed(3)})`
          : p2.c < 0.75 ? `rgba(109, 155, 255, ${al.toFixed(3)})`
          : `rgba(255, 255, 255, ${(al * 0.8).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(P.x, P.y, p2.sz, 0, TAU); ctx.fill();
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!running || !onScreen) return;
      t += 0.016;
      ptr.x += (ptr.tx - ptr.x) * 0.045;
      ptr.y += (ptr.ty - ptr.y) * 0.045;
      draw();
    };

    if (reduced) {
      draw();
      const iv = setInterval(() => { if (onScreen && running) draw(); }, 3000); /* keep data fresh, no motion */
      return () => { clearInterval(iv); ro && ro.disconnect(); io && io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
    }
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro && ro.disconnect(); io && io.disconnect();
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced, radius, particles, scrollTilt]);

  return <canvas ref={ref} className={"market-sphere " + className} aria-hidden="true" />;
}
