/* Tiny SVG sparkline for real 7-day price arrays. */
export default function Sparkline({ data, up = true, width = 90, height = 30 }) {
  if (!data || data.length < 2) return <span style={{ width, display: "inline-block" }} />;
  // downsample to <=48 points
  const step = Math.ceil(data.length / 48);
  const pts = data.filter((_, i) => i % step === 0);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (pts.length - 1)) * width).toFixed(1)},${(height - ((p - lo) / (hi - lo || 1)) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
