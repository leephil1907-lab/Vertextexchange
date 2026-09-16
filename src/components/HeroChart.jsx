/* ============================================================
   HeroChart — premium canvas area chart for the dark hero stage.
   Real 7-day CoinGecko data, live last-price blend from
   priceStore, draw-in animation, crosshair tooltip, price axis,
   pulsing last dot. Zero dependencies, DPR-aware, pauses when
   off-screen, honors prefers-reduced-motion.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { getChart, CURRENCIES, priceStore } from "../services/coingecko.js";

const EASE = (t) => 1 - Math.pow(1 - t, 3);
const DRAW_MS = 900;

function shortPrice(v, fiat) {
  const sym = CURRENCIES[fiat]?.symbol || "€";
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1000) return sym + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return sym + v.toFixed(2);
  return sym + Number(v.toPrecision(4));
}

export default function HeroChart({ coinId, fiat = "EUR", height = 156, className = "" }) {
  const reduced = !!useReducedMotion();
  const wrapRef = useRef(null);
  const cvRef = useRef(null);
  const tipRef = useRef(null);
  const kickRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const S = useRef({ pts: null, prog: 0, animStart: 0, mx: null, visible: true }).current;
  const vs = CURRENCIES[fiat]?.vs || "eur";

  /* main engine — re-created on coin/fiat/motion change */
  useEffect(() => {
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    let raf = 0;
    let alive = true;
    S.pts = null;
    S.prog = 0;
    setLoaded(false);

    const kick = () => { if (!raf && S.visible) raf = requestAnimationFrame(loop); };
    kickRef.current = kick;

    function loop(t) {
      raf = 0;
      if (!alive || !S.visible) return;
      draw(t || performance.now());
      if (!reduced) raf = requestAnimationFrame(loop); // keep pulsing
    }

    function applyData(prices, animate) {
      if (!Array.isArray(prices) || prices.length < 3) return;
      const step = Math.max(1, Math.ceil(prices.length / 96));
      const pts = prices.filter((_, i) => i % step === 0);
      const lastRaw = prices[prices.length - 1];
      if (pts[pts.length - 1][0] !== lastRaw[0]) pts.push(lastRaw);
      S.pts = pts;
      if (animate) { S.prog = reduced ? 1 : 0; S.animStart = performance.now(); }
      else S.prog = 1;
      setLoaded(true);
      kick();
    }

    getChart(coinId, vs, 7)
      .then((r) => { if (alive) applyData(r?.data?.prices, true); })
      .catch(() => { });
    const refresh = setInterval(() => {
      getChart(coinId, vs, 7)
        .then((r) => { if (alive && S.pts) applyData(r?.data?.prices, false); })
        .catch(() => { });
    }, 60000);

    /* ---- drawing ---- */
    function draw(t) {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const tip = tipRef.current;
      if (!S.pts) { if (tip) tip.style.opacity = "0"; return; }

      const pts = S.pts;
      const n = pts.length;
      const live = priceStore.quotes[coinId]?.price;
      const P = (i) => (i === n - 1 && live != null && isFinite(live) ? live : pts[i][1]);

      const padL = 4, padR = 62, padT = 12, padB = 18;
      const iw = w - padL - padR, ih = h - padT - padB;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { const p = P(i); if (p < lo) lo = p; if (p > hi) hi = p; }
      const span = (hi - lo) || hi * 0.01 || 1;
      lo -= span * 0.07; hi += span * 0.07;
      const X = (i) => padL + (i / (n - 1)) * iw;
      const Y = (p) => padT + (1 - (p - lo) / (hi - lo)) * ih;

      const up = P(n - 1) >= pts[0][1];
      const col = up ? "#37e2a2" : "#ff7079";
      const colA = up ? "rgba(55,226,162," : "rgba(255,112,121,";

      /* grid + price axis */
      ctx.font = '600 9.5px Inter, system-ui, -apple-system, sans-serif';
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const rows = 4;
      for (let g = 0; g <= rows; g++) {
        const y = Math.round(padT + (g / rows) * ih) + 0.5;
        ctx.strokeStyle = "rgba(238,243,251,.06)";
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + iw, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(238,243,251,.42)";
        ctx.fillText(shortPrice(hi - (g / rows) * (hi - lo), fiat), padL + iw + 8, y);
      }

      /* animated progress */
      if (S.prog < 1) S.prog = reduced ? 1 : Math.min(1, EASE(Math.max(0, (t - S.animStart) / DRAW_MS)));
      const upto = Math.max(2, Math.round(n * S.prog));

      /* smooth curve */
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(P(0)));
        for (let i = 1; i < upto - 1; i++) {
          ctx.quadraticCurveTo(X(i), Y(P(i)), (X(i) + X(i + 1)) / 2, (Y(P(i)) + Y(P(i + 1))) / 2);
        }
        ctx.lineTo(X(upto - 1), Y(P(upto - 1)));
      };

      /* area fill */
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
      grad.addColorStop(0, colA + "0.30)");
      grad.addColorStop(1, colA + "0)");
      trace();
      ctx.lineTo(X(upto - 1), padT + ih);
      ctx.lineTo(X(0), padT + ih);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      /* glowing line */
      trace();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = colA + "0.5)";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* date labels */
      ctx.fillStyle = "rgba(238,243,251,.38)";
      const dfmt = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      ctx.textAlign = "left";
      ctx.fillText(dfmt(pts[0][0]), padL, h - 7);
      ctx.textAlign = "center";
      ctx.fillText(dfmt(pts[Math.floor(n / 2)][0]), padL + iw / 2, h - 7);
      ctx.textAlign = "right";
      ctx.fillText(dfmt(pts[n - 1][0]), padL + iw, h - 7);

      if (S.prog >= 0.999) {
        const fx = X(n - 1), fy = Y(P(n - 1));

        /* pulsing ring */
        if (!reduced) {
          const ph = (t % 1600) / 1600;
          ctx.beginPath();
          ctx.arc(fx, fy, 4 + ph * 7, 0, Math.PI * 2);
          ctx.fillStyle = colA + (0.32 * (1 - ph)).toFixed(3) + ")";
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(fx, fy, 3.1, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.beginPath(); ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#0a1220"; ctx.fill();

        /* last-price chip */
        const label = shortPrice(P(n - 1), fiat);
        ctx.font = '800 9.5px Inter, system-ui, -apple-system, sans-serif';
        const cw = Math.max(46, ctx.measureText(label).width + 12);
        const cx = padL + iw + 6, cy = fy - 8.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx, cy, cw, 17, 5);
        else ctx.rect(cx, cy, cw, 17);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.fillStyle = "#06131f";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx + cw / 2, cy + 9);

        /* crosshair */
        if (S.mx != null) {
          let i = Math.round(((S.mx - padL) / iw) * (n - 1));
          i = Math.max(0, Math.min(n - 1, i));
          const px = X(i), py = Y(P(i));
          ctx.strokeStyle = "rgba(238,243,251,.28)";
          ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + ih); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(px, py, 4.4, 0, Math.PI * 2);
          ctx.fillStyle = colA + "0.25)"; ctx.fill();
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = "#fff"; ctx.fill();
          if (tip) {
            const d = new Date(pts[i][0]);
            tip.style.opacity = "1";
            tip.style.left = Math.min(Math.max(px, 58), w - 58) + "px";
            tip.style.top = Math.max(py - 56, 0) + "px";
            tip.innerHTML =
              "<b>" + shortPrice(P(i), fiat) + "</b><small>" +
              d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " · " +
              d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "</small>";
          }
        } else if (tip) tip.style.opacity = "0";
      } else if (tip) tip.style.opacity = "0";
    }

    /* ---- observers ---- */
    const io = new IntersectionObserver((es) => {
      S.visible = es[0]?.isIntersecting !== false;
      if (S.visible) kick();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0.05 });
    io.observe(wrap);
    const ro = new ResizeObserver(() => kick());
    ro.observe(wrap);
    const onDocVis = () => {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      else kick();
    };
    document.addEventListener("visibilitychange", onDocVis);
    const unsub = priceStore.subscribe(() => kick()); // live tip updates (needed in reduced mode)

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearInterval(refresh);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onDocVis);
      unsub();
      kickRef.current = null;
    };
  }, [coinId, vs, fiat, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e) => {
    const cv = cvRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    S.mx = e.clientX - r.left;
    kickRef.current?.();
  };
  const onLeave = () => { S.mx = null; kickRef.current?.(); };

  return (
    <div
      className={"hero-chart " + className}
      style={{ height }}
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role="img"
      aria-label={`7-day price chart for ${coinId} in ${fiat}`}
    >
      {!loaded && <div className="skeleton hc-skel" />}
      <canvas ref={cvRef} />
      <div className="hc-tip" ref={tipRef} aria-hidden="true" />
    </div>
  );
}
