/* Robust coin icon: real logo image when available, premium gradient
   badge fallback (deterministic hue from symbol) when missing/broken. */
import { useState } from "react";

export default function CoinIcon({ src, symbol = "?", size = 24, className = "" }) {
  const [failed, setFailed] = useState(false);
  const label = String(symbol || "?").toUpperCase().slice(0, 4);
  const style = { width: size, height: size };

  if (src && !failed) {
    return (
      <img
        className={"coin-icon " + className}
        src={src}
        alt=""
        loading="lazy"
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  // deterministic hue from symbol so each coin keeps a stable color
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  return (
    <span
      className={"coin-icon coin-icon-fb " + className}
      style={{
        ...style,
        fontSize: Math.max(7.5, Math.round(size * (label.length > 3 ? 0.26 : 0.34))),
        background: `linear-gradient(148deg, hsl(${h} 72% 54%), hsl(${(h + 42) % 360} 74% 36%))`,
      }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
