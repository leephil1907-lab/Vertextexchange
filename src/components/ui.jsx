import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

/* ---------- animated count-up number (scroll-triggered) ---------- */
export function Counter({ to, decimals = 0, prefix = "", suffix = "", duration = 1.5 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVal(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / (duration * 1000));
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref} className="tnum">
      {prefix}{val.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}
    </span>
  );
}

/* ---------- scroll reveal wrapper ---------- */
export function Reveal({ children, delay = 0, y = 26, className = "", ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.65, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ---------- motion link button ---------- */
export function Btn({ to, href, className = "", children, ...rest }) {
  const Comp = to ? Link : "a";
  const props = to ? { to } : { href: href || "#" };
  return (
    <motion.span
      whileHover={{ scale: 1.035, y: -1 }}
      whileTap={{ scale: 0.97 }}
      style={{ display: "inline-flex" }}
    >
      <Comp className={className} {...props} {...rest}>{children}</Comp>
    </motion.span>
  );
}

export function Section({ alt, id, children, style }) {
  return <section id={id} className={"section" + (alt ? " section-alt" : "")} style={style}>{children}</section>;
}

export function SectionHead({ kicker, title, text }) {
  return (
    <Reveal className="section-head">
      {kicker && <div className="kicker">{kicker}</div>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </Reveal>
  );
}

export function PageHero({ crumb, title, text, children, img }) {
  return (
    <section className="page-hero" style={img ? { position: "relative", overflow: "hidden" } : undefined}>
      {img && (
        <>
          <img className="bg-img" src={img} alt="" aria-hidden="true" />
          <div className="bg-scrim" />
        </>
      )}
      <div className={"container" + (img ? " on-media" : "")} style={{ position: "relative", zIndex: 2 }}>
        <motion.div className="crumbs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Link to="/">Home</Link> / {crumb}
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>{title}</motion.h1>
        {text && <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.13 }}>{text}</motion.p>}
        {children}
      </div>
    </section>
  );
}

/* ---------- animated tabs ---------- */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={"tab-btn" + (active === t.id ? " active" : "")}
          onClick={() => onChange(t.id)}
        >
          {active === t.id && <motion.span className="tab-pill" layoutId="tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span style={{ position: "relative", zIndex: 1 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- FAQ accordion ---------- */
export function Faq({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div>
      {items.map((f, i) => (
        <div key={i} className={"faq-item" + (open === i ? " open" : "")}>
          <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <motion.span className="arrow" animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.25 }}>▾</motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div className="faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: "easeInOut" }} style={{ overflow: "hidden" }}>
                <p>{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export function StatBand({ stats }) {
  return (
    <div className="stat-band">
      {stats.map((s, i) => (
        <Reveal key={i} delay={i * 0.07}>
          <div className="num grad-text">{s.num}</div>
          <div className="lbl">{s.lbl}</div>
        </Reveal>
      ))}
    </div>
  );
}

export function Steps({ steps }) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <Reveal key={i} delay={i * 0.08} className="step">
          <h3>{s.h}</h3>
          <p>{s.p}</p>
        </Reveal>
      ))}
    </div>
  );
}

export function CtaBand({ title, text, children, img }) {
  return (
    <Reveal className="cta-band" style={img ? { position: "relative", overflow: "hidden" } : undefined}>
      {img && (
        <>
          <img className="bg-img" src={img} alt="" aria-hidden="true" />
          <div className="bg-scrim" style={{ background: "linear-gradient(100deg, rgba(6,10,20,.93), rgba(6,10,20,.72))" }} />
        </>
      )}
      <div className={img ? "on-media" : ""} style={{ position: "relative", zIndex: 2 }}>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>{children}</div>
      </div>
    </Reveal>
  );
}

/* ---------- generic data table ---------- */
export function DataTable({ head, rows, minWidth }) {
  return (
    <div className="table-wrap">
      <table className="data" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} className={h.num ? "num tnum" : ""}>{h.label || h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => {
                const isObj = cell && typeof cell === "object" && "v" in cell;
                const v = isObj ? cell.v : cell;
                const cls = (isObj && cell.num ? "num " : "") + (isObj && cell.cls ? cell.cls : "") + " tnum";
                return <td key={j} className={cls}>{v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
