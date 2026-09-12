/* Reusable real-data candlestick chart with EMA/volume/RSI/MACD panes.
   Original code built on the open-source lightweight-charts library. */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { emaSeries, rsiSeries, macdSeries } from "../engine/indicators.js";

const THEMES = {
  dark: { text: "#9db0cc", grid: "rgba(109,155,255,.08)", border: "rgba(109,155,255,.22)", labelBg: "#152542" },
  light: { text: "#51607e", grid: "rgba(23,43,99,.08)", border: "rgba(23,43,99,.16)", labelBg: "#e8ecf6" },
};

function chartOpts(theme, height) {
  const c = THEMES[theme] || THEMES.dark;
  return {
    autoSize: true,
    layout: { background: { color: "transparent" }, textColor: c.text, fontFamily: "Inter, sans-serif", fontSize: 11 },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border },
    timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 8 },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: "rgba(143,161,194,.45)", labelBackgroundColor: c.labelBg },
      horzLine: { color: "rgba(143,161,194,.45)", labelBackgroundColor: c.labelBg },
    },
    height,
  };
}

const CandleChart = forwardRef(function CandleChart(
  { candles = [], theme = "dark", height = 420, indicators = {}, onHoverCandle, priceLines = [] },
  ref
) {
  const mainRef = useRef(null);
  const rsiRef = useRef(null);
  const macdRef = useRef(null);
  const R = useRef({});
  const syncing = useRef(false);

  /* responsive chart height: contain within viewport on small screens */
  const [h, setH] = useState(height);
  useEffect(() => {
    const on = () => setH(window.innerWidth < 720 ? Math.max(240, Math.round(height * 0.68)) : height);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [height]);

  /* create charts */
  useEffect(() => {
    const main = createChart(mainRef.current, chartOpts(theme, h));
    const c = THEMES[theme] || THEMES.dark;
    const candlesS = main.addCandlestickSeries({
      upColor: "#1FBF65", downColor: "#F2555B", wickUpColor: "#1FBF65", wickDownColor: "#F2555B", borderVisible: false,
    });
    const volS = main.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
    main.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    const ema20S = main.addLineSeries({ color: "#f59e0b", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ema50S = main.addLineSeries({ color: "#3a6fe0", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    R.current = { main, candlesS, volS, ema20S, ema50S, rsi: null, macd: null, lines: [] };

    main.subscribeCrosshairMove((param) => {
      if (!onHoverCandle) return;
      if (!param.time) return onHoverCandle(null);
      const d = param.seriesData.get(candlesS);
      if (d) onHoverCandle(d);
    });

    main.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || syncing.current) return;
      syncing.current = true;
      try {
        R.current.rsi && R.current.rsi.chart.timeScale().setVisibleLogicalRange(range);
        R.current.macd && R.current.macd.chart.timeScale().setVisibleLogicalRange(range);
      } finally { syncing.current = false; }
    });
    void c;
    return () => { main.remove(); R.current.rsi = null; R.current.macd = null; };
  }, [theme, h]);

  /* RSI pane */
  useEffect(() => {
    if (!indicators.rsi) {
      if (R.current.rsi) { R.current.rsi.chart.remove(); R.current.rsi = null; }
      return;
    }
    if (R.current.rsi) return;
    const chart = createChart(rsiRef.current, { ...chartOpts(theme, 110), timeScale: { ...chartOpts(theme, 110).timeScale } });
    const line = chart.addLineSeries({ color: "#009e91", lineWidth: 1.6, priceLineVisible: false, lastValueVisible: true });
    line.createPriceLine({ price: 70, color: "rgba(255,93,115,.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "" });
    line.createPriceLine({ price: 30, color: "rgba(31,191,101,.55)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "" });
    chart.priceScale("right").applyOptions({ autoScale: false });
    line.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
    R.current.rsi = { chart, line };
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || syncing.current) return;
      syncing.current = true;
      try {
        R.current.main && R.current.main.timeScale().setVisibleLogicalRange(range);
        R.current.macd && R.current.macd.chart.timeScale().setVisibleLogicalRange(range);
      } finally { syncing.current = false; }
    });
  }, [indicators.rsi, theme]);

  /* MACD pane */
  useEffect(() => {
    if (!indicators.macd) {
      if (R.current.macd) { R.current.macd.chart.remove(); R.current.macd = null; }
      return;
    }
    if (R.current.macd) return;
    const chart = createChart(macdRef.current, chartOpts(theme, 130));
    const hist = chart.addHistogramSeries({ priceFormat: { precision: 6, minMove: 1e-8 }, priceLineVisible: false, lastValueVisible: false });
    const macdL = chart.addLineSeries({ color: "#3a6fe0", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sigL = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    R.current.macd = { chart, hist, macdL, sigL };
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || syncing.current) return;
      syncing.current = true;
      try {
        R.current.main && R.current.main.timeScale().setVisibleLogicalRange(range);
        R.current.rsi && R.current.rsi.chart.timeScale().setVisibleLogicalRange(range);
      } finally { syncing.current = false; }
    });
  }, [indicators.macd, theme]);

  /* data */
  useEffect(() => {
    const r = R.current;
    if (!r.main || !candles.length) return;
    const t = (x) => Math.floor(x.t / 1000);
    r.candlesS.setData(candles.map((c) => ({ time: t(c), open: c.o, high: c.h, low: c.l, close: c.c })));
    if (indicators.volume !== false) {
      r.volS.setData(candles.map((c) => ({ time: t(c), value: c.v, color: c.c >= c.o ? "rgba(31,191,101,.3)" : "rgba(242,85,91,.3)" })));
    } else r.volS.setData([]);
    r.ema20S.setData(indicators.ema20 ? emaSeries(candles, 20) : []);
    r.ema50S.setData(indicators.ema50 ? emaSeries(candles, 50) : []);
    if (r.rsi) r.rsi.line.setData(indicators.rsi ? rsiSeries(candles) : []);
    if (r.macd) {
      const m = indicators.macd ? macdSeries(candles) : [];
      r.macd.macdL.setData(m.map((x) => ({ time: x.time, value: x.macd })));
      r.macd.sigL.setData(m.map((x) => ({ time: x.time, value: x.signal })));
      r.macd.hist.setData(m.map((x) => ({ time: x.time, value: x.hist, color: x.hist >= 0 ? "rgba(31,191,101,.55)" : "rgba(242,85,91,.55)" })));
    }
  }, [candles, indicators]);

  /* price lines (orders/alerts) */
  useImperativeHandle(ref, () => ({
    setPriceLines(lines) {
      const r = R.current;
      if (!r.main) return;
      r.lines.forEach((l) => { try { r.candlesS.removePriceLine(l); } catch (e) { /* chart gone */ } });
      r.lines = (lines || []).map((l) => r.candlesS.createPriceLine({
        price: l.price, color: l.color || "#f59e0b", lineWidth: 1,
        lineStyle: l.style === "dotted" ? LineStyle.Dotted : LineStyle.Dashed,
        axisLabelVisible: true, title: l.title || "",
      }));
    },
  }), []);

  useEffect(() => {
    if (ref && ref.current && ref.current.setPriceLines) ref.current.setPriceLines(priceLines);
  }, [priceLines]);

  return (
    <div>
      <div ref={mainRef} style={{ height: h }} />
      {indicators.rsi && (
        <div className="pane-chart" style={{ position: "relative" }}>
          <span className="pane-label">RSI 14</span>
          <div ref={rsiRef} style={{ height: 110 }} />
        </div>
      )}
      {indicators.macd && (
        <div className="pane-chart" style={{ position: "relative" }}>
          <span className="pane-label">MACD 12·26·9</span>
          <div ref={macdRef} style={{ height: 130 }} />
        </div>
      )}
    </div>
  );
});

export default CandleChart;
