/* Premium SVG sparkline for real 7-day price arrays:
   smoothed line + gradient area fill + glowing last-price dot. */
import { useId } from "react";

export default function Sparkline({ data, up = true, width = 90, height = 30 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!data || data.length < 2) return <span style={{ width, display: "inline-block" }} />;

  // downsample to <=64 points, always keep the final point
  const step = Math.max(1, Math.ceil(data.length / 64));
  const pts = data.filter((_, i) => i % step === 0);
  if (pts[pts.length - 1] !== data[data.length - 1]) pts.push(data[data.length - 1]);

  const pad = 3;
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const X = (i) => (i / (pts.length - 1)) * width;
  const Y = (p) => height - pad - ((p - lo) / (hi - lo || 1)) * (height - pad * 2.6);

  // smooth curve through midpoints (quadratic segments)
  let d = `M${X(0).toFixed(1)},${Y(pts[0]).toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((X(i) + X(i + 1)) / 2).toFixed(1);
    const my = ((Y(pts[i]) + Y(pts[i + 1])) / 2).toFixed(1);
    d += ` Q${X(i).toFixed(1)},${Y(pts[i]).toFixed(1)} ${mx},${my}`;
  }
  d += ` L${X(pts.length - 1).toFixed(1)},${Y(pts[pts.length - 1]).toFixed(1)}`;
  const area = `${d} L${width},${height} L0,${height} Z`;

  const color = up ? "var(--up)" : "var(--down)";
  const lx = X(pts.length - 1), ly = Y(pts[pts.length - 1]);

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sp${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.4" fill={color} opacity="0.22" />
      <circle cx={lx} cy={ly} r="1.7" fill={color} />
    </svg>
  );
}
