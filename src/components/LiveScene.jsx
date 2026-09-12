import { useEffect, useRef } from "react";
import { priceStore, CURRENCIES } from "../services/coingecko.js";
import { useApp } from "../app-context.jsx";

const IDS = ["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "avalanche-2", "chainlink", "litecoin", "tron", "polkadot", "chainlink"];

/* A living image: cinematic candlestick-city scene rendered on canvas,
   driven by REAL live CoinGecko prices — bars breathe toward each coin's
   live 24h change, aurora and stars animate, reflections shimmer. */
export default function LiveScene() {
  const ref = useRef(null);
  const { fiat } = useApp();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro && ro.observe(cv);

    const ids = [...new Set(IDS)];
    const bars = ids.map((id, i) => ({ id, cur: 0.3 + (i % 4) * 0.08, tgt: 0.4, wick: 0.08, up: true, phase: Math.random() * Math.PI * 2 }));
    const stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.3 + 0.3, p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.6 }));

    const read = () => {
      bars.forEach((b) => {
        const q = priceStore.quotes[b.id];
        if (!q) return;
        const chg = q.change24h ?? 0;
        b.up = chg >= 0;
        b.tgt = 0.24 + Math.min(0.52, Math.abs(chg) / 14 + 0.1);
        b.wick = 0.04 + Math.min(0.16, Math.abs(chg) / 45);
      });
    };
    priceStore.configure(ids, CURRENCIES[fiat]?.vs || "eur", 20000);
    read();
    const unsub = priceStore.subscribe(read);

    let t = 0, raf = 0;
    const draw = () => {
      t += 0.016;
      raf = requestAnimationFrame(draw);
      if (!W || !H) return;
      /* night sky */
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#04070e");
      sky.addColorStop(0.55, "#081120");
      sky.addColorStop(1, "#0a1526");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      /* stars */
      for (const s of stars) {
        const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
        ctx.globalAlpha = a;
        ctx.fillStyle = "#cfe3ff";
        ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
      }
      ctx.globalAlpha = 1;

      /* aurora ribbons */
      ctx.globalCompositeOperation = "lighter";
      const ribbons = [
        ["rgba(184,242,41,", 0.16, 26, 0.9],
        ["rgba(79,140,255,", 0.24, 34, 0.7],
        ["rgba(140,90,255,", 0.1, 20, 0.5],
      ];
      for (const [col, yb, amp, sp] of ribbons) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = H * yb + Math.sin(x * 0.006 + t * sp) * amp + Math.sin(x * 0.013 - t * sp * 0.6) * amp * 0.5;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = col + "0.09)";
        ctx.lineWidth = 26;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      /* horizon */
      const y0 = H * 0.8;
      const glow = ctx.createLinearGradient(0, y0 - 40, 0, y0 + 40);
      glow.addColorStop(0, "rgba(184,242,41,0)");
      glow.addColorStop(0.5, "rgba(184,242,41,0.14)");
      glow.addColorStop(1, "rgba(184,242,41,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, y0 - 40, W, 80);

      /* candlestick city — each bar breathes toward its live target */
      const n = bars.length;
      const slot = W / n;
      bars.forEach((b, i) => {
        b.cur += (b.tgt - b.cur) * 0.035;
        const breathe = 1 + Math.sin(t * 0.8 + b.phase) * 0.02;
        const bh = b.cur * H * 0.62 * breathe;
        const bw = Math.max(8, slot * 0.42);
        const x = slot * i + slot / 2;
        const col = b.up ? "#1FBF65" : "#F2555B";
        /* wick */
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y0 - bh - b.wick * H);
        ctx.lineTo(x, y0 - bh + 6);
        ctx.stroke();
        /* body with glow */
        ctx.globalAlpha = 0.92;
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.fillStyle = col;
        ctx.fillRect(x - bw / 2, y0 - bh, bw, bh);
        ctx.shadowBlur = 0;
        /* inner shade */
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#04070e";
        ctx.fillRect(x - bw / 2 + bw * 0.62, y0 - bh, bw * 0.38, bh);
        /* reflection */
        ctx.globalAlpha = 0.14;
        const rg = ctx.createLinearGradient(0, y0, 0, y0 + bh * 0.5);
        rg.addColorStop(0, col);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(x - bw / 2, y0 + 2, bw, bh * 0.5);
        ctx.globalAlpha = 1;
      });

      /* ground grid */
      ctx.strokeStyle = "rgba(120,160,220,0.07)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const y = y0 + i * i * 3;
        if (y > H) break;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      /* vignette */
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); unsub(); ro && ro.disconnect(); };
  }, [fiat]);

  return <canvas ref={ref} className="hero-img" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-label="Living image: candlestick cityscape animated by live market prices" />;
}
