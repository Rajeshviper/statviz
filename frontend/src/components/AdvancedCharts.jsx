import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

function Card({ children, title }) {
  return (
    <div style={{
      background: "#fff", border: "0.5px solid #e2e0d8",
      borderRadius: 14, padding: 20,
    }}>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: "#2c2c2a", marginBottom: 14 }}>{title}</div>}
      {children}
    </div>
  );
}

// ── Box Plot ──────────────────────────────────────────────────────────────────
function BoxPlot({ columns }) {
  const ref = useRef();
  const numCols = columns.filter(c => c.type === "numeric");

  useEffect(() => {
    if (!numCols.length) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 60, left: 50 };
    const width = ref.current.clientWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const g = svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(numCols.map(c => c.name))
      .range([0, width])
      .padding(0.3);

    // Normalize y scale across all columns
    const allMins = numCols.map(c => c.min);
    const allMaxs = numCols.map(c => c.max);
    const y = d3.scaleLinear()
      .domain([Math.min(...allMins) * 0.95, Math.max(...allMaxs) * 1.05])
      .range([height, 0]);

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(-width))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1efe8"))
      .call(g => g.selectAll(".tick text").attr("fill", "#888780").attr("font-size", 10));

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .call(g => g.select(".domain").attr("stroke", "#e2e0d8"))
      .call(g => g.selectAll(".tick line").remove())
      .call(g => g.selectAll(".tick text")
        .attr("fill", "#888780")
        .attr("font-size", 10)
        .attr("transform", "rotate(-20)")
        .attr("text-anchor", "end"));

    const colors = ["#185fa5", "#1d9e75", "#ba7517", "#a32d2d", "#534ab7"];

    numCols.forEach((col, i) => {
      const cx = x(col.name) + x.bandwidth() / 2;
      const bw = x.bandwidth();
      const color = colors[i % colors.length];

      // IQR box
      g.append("rect")
        .attr("x", cx - bw / 2)
        .attr("y", y(col.q3))
        .attr("width", bw)
        .attr("height", y(col.q1) - y(col.q3))
        .attr("fill", color)
        .attr("opacity", 0.2)
        .attr("rx", 4);

      g.append("rect")
        .attr("x", cx - bw / 2)
        .attr("y", y(col.q3))
        .attr("width", bw)
        .attr("height", y(col.q1) - y(col.q3))
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("rx", 4);

      // Median line
      g.append("line")
        .attr("x1", cx - bw / 2).attr("x2", cx + bw / 2)
        .attr("y1", y(col.median)).attr("y2", y(col.median))
        .attr("stroke", color).attr("stroke-width", 2.5);

      // Whiskers
      const whiskerLow = Math.max(col.min, col.q1 - 1.5 * col.iqr);
      const whiskerHigh = Math.min(col.max, col.q3 + 1.5 * col.iqr);

      [[whiskerLow, col.q1], [col.q3, whiskerHigh]].forEach(([a, b]) => {
        g.append("line")
          .attr("x1", cx).attr("x2", cx)
          .attr("y1", y(a)).attr("y2", y(b))
          .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "3,2");
        g.append("line")
          .attr("x1", cx - bw / 4).attr("x2", cx + bw / 4)
          .attr("y1", y(a)).attr("y2", y(a))
          .attr("stroke", color).attr("stroke-width", 1.5);
      });

      // Mean dot
      g.append("circle")
        .attr("cx", cx).attr("cy", y(col.mean))
        .attr("r", 4).attr("fill", color).attr("opacity", 0.8);
    });

  }, [columns]);

  if (!numCols.length) return null;

  return (
    <Card title="📦 Box Plot — quartiles, median & spread">
      <div style={{ fontSize: 11, color: "#888780", marginBottom: 10 }}>
        Box = IQR (Q1–Q3) · Line = Median · Dot = Mean · Whiskers = 1.5×IQR
      </div>
      <svg ref={ref} style={{ width: "100%" }} />
    </Card>
  );
}

// ── QQ Plot ───────────────────────────────────────────────────────────────────
function QQPlot({ columns }) {
  const ref = useRef();
  const numCols = columns.filter(c => c.type === "numeric" && c.histogram);
  const [selected, setSelected] = useState(numCols[0]?.name || "");
  const col = numCols.find(c => c.name === selected);

  useEffect(() => {
    if (!col) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = ref.current.clientWidth - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const g = svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Generate approximate quantiles from histogram
    const counts = col.histogram.counts;
    const bins = col.histogram.bins;
    const total = counts.reduce((a, b) => a + b, 0);

    const points = [];
    let cumulative = 0;
    counts.forEach((count, i) => {
      for (let j = 0; j < count; j++) {
        cumulative++;
        const p = (cumulative - 0.5) / total;
        const theoretical = d3.quantileSorted(
          d3.range(0, 1.001, 0.001).map(q => d3.quantileSorted([-3,-2,-1,0,1,2,3], q)),
          p
        );
        const empirical = bins[i] + (bins[i + 1] - bins[i]) * (j + 0.5) / count;
        points.push({ x: theoretical || 0, y: empirical });
      }
    });

    const xExtent = d3.extent(points, d => d.x);
    const yExtent = d3.extent(points, d => d.y);

    const x = d3.scaleLinear().domain(xExtent).range([0, width]);
    const y = d3.scaleLinear().domain(yExtent).range([height, 0]);

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(-width))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1efe8"))
      .call(g => g.selectAll(".tick text").attr("fill", "#888780").attr("font-size", 10));

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .call(g => g.select(".domain").attr("stroke", "#e2e0d8"))
      .call(g => g.selectAll(".tick line").remove())
      .call(g => g.selectAll(".tick text").attr("fill", "#888780").attr("font-size", 10));

    // Reference line
    g.append("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", height).attr("y2", 0)
      .attr("stroke", "#e2e0d8").attr("stroke-width", 1.5).attr("stroke-dasharray", "5,3");

    // Points
    g.selectAll("circle")
      .data(points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 100)) === 0))
      .join("circle")
      .attr("cx", d => x(d.x))
      .attr("cy", d => y(d.y))
      .attr("r", 3)
      .attr("fill", "#185fa5")
      .attr("opacity", 0.6);

    // Axis labels
    g.append("text")
      .attr("x", width / 2).attr("y", height + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#888780").attr("font-size", 10)
      .text("Theoretical quantiles (Normal)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", "#888780").attr("font-size", 10)
      .text("Sample quantiles");

  }, [col]);

  if (!numCols.length) return null;

  return (
    <Card title="📈 QQ Plot — normality check">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#888780" }}>
          Points on the line = normally distributed
        </div>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fafaf8", color: "#2c2c2a" }}
        >
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <svg ref={ref} style={{ width: "100%" }} />
      {col && (
        <div style={{ marginTop: 8, fontSize: 11, color: col.is_normal ? "#3b6d11" : "#a32d2d" }}>
          {col.is_normal
            ? `✓ ${col.name} appears normally distributed (Shapiro-Wilk p=${col.normality_p?.toFixed(3)})`
            : `✗ ${col.name} is not normally distributed (Shapiro-Wilk p=${col.normality_p?.toFixed(3)})`
          }
        </div>
      )}
    </Card>
  );
}

// ── Violin Plot (approximated with area chart) ────────────────────────────────
function ViolinPlot({ columns }) {
  const ref = useRef();
  const numCols = columns.filter(c => c.type === "numeric" && c.histogram);
  const [selected, setSelected] = useState(numCols[0]?.name || "");
  const col = numCols.find(c => c.name === selected);

  useEffect(() => {
    if (!col) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const width = ref.current.clientWidth - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const g = svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const counts = col.histogram.counts;
    const bins = col.histogram.bins;
    const maxCount = Math.max(...counts);

    // Build violin data points
    const points = counts.map((count, i) => ({
      value: (bins[i] + bins[i + 1]) / 2,
      density: count / maxCount,
    }));

    const y = d3.scaleLinear()
      .domain([bins[0], bins[bins.length - 1]])
      .range([height, 0]);

    const x = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, width]);

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSize(-width))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1efe8"))
      .call(g => g.selectAll(".tick text").attr("fill", "#888780").attr("font-size", 10));

    // Violin shape
    const areaGen = d3.area()
      .y(d => y(d.value))
      .x0(d => x(-d.density))
      .x1(d => x(d.density))
      .curve(d3.curveCatmullRom);

    g.append("path")
      .datum(points)
      .attr("d", areaGen)
      .attr("fill", "#185fa5")
      .attr("opacity", 0.2);

    g.append("path")
      .datum(points)
      .attr("d", d3.line().y(d => y(d.value)).x(d => x(d.density)).curve(d3.curveCatmullRom))
      .attr("fill", "none").attr("stroke", "#185fa5").attr("stroke-width", 2);

    g.append("path")
      .datum(points)
      .attr("d", d3.line().y(d => y(d.value)).x(d => x(-d.density)).curve(d3.curveCatmullRom))
      .attr("fill", "none").attr("stroke", "#185fa5").attr("stroke-width", 2);

    // Median line
    g.append("line")
      .attr("x1", x(-0.5)).attr("x2", x(0.5))
      .attr("y1", y(col.median)).attr("y2", y(col.median))
      .attr("stroke", "#185fa5").attr("stroke-width", 2.5);

    // Mean dot
    g.append("circle")
      .attr("cx", x(0)).attr("cy", y(col.mean))
      .attr("r", 5).attr("fill", "#185fa5");

    // Center line
    g.append("line")
      .attr("x1", x(0)).attr("x2", x(0))
      .attr("y1", 0).attr("y2", height)
      .attr("stroke", "#e2e0d8").attr("stroke-width", 1).attr("stroke-dasharray", "3,2");

    // X axis label
    g.append("text")
      .attr("x", width / 2).attr("y", height + 38)
      .attr("text-anchor", "middle")
      .attr("fill", "#888780").attr("font-size", 11)
      .text(col.name);

  }, [col]);

  if (!numCols.length) return null;

  return (
    <Card title="🎻 Violin Plot — distribution shape">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#888780" }}>
          Width = density · Line = Median · Dot = Mean
        </div>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fafaf8", color: "#2c2c2a" }}
        >
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <svg ref={ref} style={{ width: "100%" }} />
    </Card>
  );
}

// ── Correlation Heatmap ───────────────────────────────────────────────────────
function CorrelationHeatmap({ correlation }) {
  const ref = useRef();

  useEffect(() => {
    if (!correlation) return;
    const { columns, matrix } = correlation;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const n = columns.length;
    const size = Math.min(480, ref.current.clientWidth);
    const cellSize = Math.floor((size - 80) / n);
    const margin = { top: 20, right: 20, bottom: 80, left: 80 };
    const w = cellSize * n;
    const h = cellSize * n;

    const g = svg
      .attr("width", w + margin.left + margin.right)
      .attr("height", h + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const colorScale = d3.scaleLinear()
      .domain([-1, 0, 1])
      .range(["#a32d2d", "#f7f6f1", "#185fa5"]);

    matrix.forEach((row, i) => {
      row.forEach((val, j) => {
        if (val == null) return;

        g.append("rect")
          .attr("x", j * cellSize).attr("y", i * cellSize)
          .attr("width", cellSize - 2).attr("height", cellSize - 2)
          .attr("rx", 4)
          .attr("fill", colorScale(val));

        g.append("text")
          .attr("x", j * cellSize + cellSize / 2)
          .attr("y", i * cellSize + cellSize / 2 + 4)
          .attr("text-anchor", "middle")
          .attr("font-size", Math.min(11, cellSize * 0.3))
          .attr("fill", Math.abs(val) > 0.5 ? "#fff" : "#2c2c2a")
          .attr("font-weight", 500)
          .text(val.toFixed(2));
      });
    });

    // Column labels (top)
    columns.forEach((col, i) => {
      g.append("text")
        .attr("x", i * cellSize + cellSize / 2)
        .attr("y", -6)
        .attr("text-anchor", "middle")
        .attr("font-size", Math.min(10, cellSize * 0.28))
        .attr("fill", "#888780")
        .text(col.length > 8 ? col.slice(0, 8) + "…" : col);
    });

    // Row labels (left)
    columns.forEach((col, i) => {
      g.append("text")
        .attr("x", -6).attr("y", i * cellSize + cellSize / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", Math.min(10, cellSize * 0.28))
        .attr("fill", "#888780")
        .text(col.length > 8 ? col.slice(0, 8) + "…" : col);
    });

    // Legend
    const legendW = 120, legendH = 10;
    const legendX = w / 2 - legendW / 2;
    const legendY = h + 30;

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "corrGrad");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#a32d2d");
    grad.append("stop").attr("offset", "50%").attr("stop-color", "#f7f6f1");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#185fa5");

    g.append("rect")
      .attr("x", legendX).attr("y", legendY)
      .attr("width", legendW).attr("height", legendH)
      .attr("rx", 3)
      .attr("fill", "url(#corrGrad)");

    [[-1, "−1"], [0, "0"], [1, "+1"]].forEach(([val, label]) => {
      g.append("text")
        .attr("x", legendX + (val + 1) / 2 * legendW)
        .attr("y", legendY + legendH + 14)
        .attr("text-anchor", "middle")
        .attr("font-size", 9).attr("fill", "#888780")
        .text(label);
    });

  }, [correlation]);

  if (!correlation) return (
    <Card title="🔥 Correlation Heatmap">
      <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 13 }}>
        Need at least 2 numeric columns.
      </div>
    </Card>
  );

  return (
    <Card title="🔥 Correlation Heatmap">
      <div style={{ fontSize: 11, color: "#888780", marginBottom: 10 }}>
        Blue = positive · Red = negative · White = no correlation
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg ref={ref} />
      </div>
    </Card>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AdvancedCharts({ columns, correlation }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <BoxPlot columns={columns} />
        <ViolinPlot columns={columns} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <QQPlot columns={columns} />
        <CorrelationHeatmap correlation={correlation} />
      </div>
    </div>
  );
}