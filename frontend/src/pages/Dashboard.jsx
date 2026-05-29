import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const COLORS = ["#185fa5", "#1d9e75", "#ba7517", "#a32d2d", "#534ab7", "#0f6e56"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, d = 1) => (n == null ? "—" : Number(n).toFixed(d));

function Badge({ children, color = "blue" }) {
  const colors = {
    blue:  { bg: "#e6f1fb", text: "#185fa5" },
    green: { bg: "#eaf3de", text: "#3b6d11" },
    gray:  { bg: "#f1efe8", text: "#5f5e5a" },
  };
  const c = colors[color];
  return (
    <span style={{
      background: c.bg, color: c.text, borderRadius: 99,
      fontSize: 11, padding: "2px 10px", fontWeight: 500,
    }}>
      {children}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: "#2c2c2a", marginBottom: 14, letterSpacing: "-0.01em" }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "#fff", border: "0.5px solid #e2e0d8",
      borderRadius: 14, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

// ── Chart: Bar — numeric column means ────────────────────────────────────────
function MeansBarChart({ columns }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const data = numCols.map(c => ({
    name: c.name,
    Mean: parseFloat(fmt(c.mean)),
    Median: parseFloat(fmt(c.median)),
  }));

  return (
    <Card>
      <SectionTitle>Mean vs Median — all numeric columns</SectionTitle>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1efe8" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888780" }} angle={-20} textAnchor="end" />
          <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e2e0d8" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar dataKey="Mean" fill="#185fa5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Median" fill="#1d9e75" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Chart: Histogram for selected column ─────────────────────────────────────
function HistogramChart({ columns }) {
  const numCols = columns.filter(c => c.type === "numeric" && c.histogram);
  const [selected, setSelected] = useState(numCols[0]?.name || "");
  const col = numCols.find(c => c.name === selected);

  const data = col
    ? col.histogram.counts.map((count, i) => ({
        bin: `${col.histogram.bins[i]}–${col.histogram.bins[i + 1]}`,
        count,
      }))
    : [];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <SectionTitle style={{ margin: 0 }}>Distribution histogram</SectionTitle>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            fontSize: 12, padding: "5px 10px", borderRadius: 8,
            border: "0.5px solid #d3d1c7", background: "#fafaf8",
            color: "#2c2c2a", cursor: "pointer",
          }}
        >
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1efe8" />
          <XAxis dataKey="bin" tick={{ fontSize: 10, fill: "#888780" }} angle={-25} textAnchor="end" />
          <YAxis tick={{ fontSize: 11, fill: "#888780" }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e2e0d8" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Chart: Scatter — pick X and Y columns ────────────────────────────────────
function ScatterPlot({ columns, preview, rawRows }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [xCol, setXCol] = useState(numCols[0]?.name || "");
  const [yCol, setYCol] = useState(numCols[1]?.name || numCols[0]?.name || "");

  const data = (rawRows || []).map(row => ({
    x: parseFloat(row[xCol]),
    y: parseFloat(row[yCol]),
  })).filter(d => !isNaN(d.x) && !isNaN(d.y));

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <SectionTitle style={{ margin: 0 }}>Scatter plot</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fafaf8", color: "#2c2c2a" }}>
            {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <span style={{ alignSelf: "center", color: "#888780", fontSize: 12 }}>vs</span>
          <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fafaf8", color: "#2c2c2a" }}>
            {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 13 }}>
          Upload the full dataset to see scatter plot (preview only has 5 rows)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1efe8" />
            <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11, fill: "#888780" }} label={{ value: xCol, position: "insideBottom", offset: -4, fontSize: 11, fill: "#888780" }} />
            <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11, fill: "#888780" }} label={{ value: yCol, angle: -90, position: "insideLeft", fontSize: 11, fill: "#888780" }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e2e0d8" }} />
            <Scatter data={data} fill="#185fa5" opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ── Chart: Radar — compare std devs ──────────────────────────────────────────
function RadarOverview({ columns }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const data = numCols.map(c => ({
    col: c.name,
    "Std Dev": parseFloat(fmt(c.std)),
    "Mean": parseFloat(fmt(c.mean, 0)),
  }));

  return (
    <Card>
      <SectionTitle>Spread overview (radar)</SectionTitle>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data}>
          <PolarGrid stroke="#f1efe8" />
          <PolarAngleAxis dataKey="col" tick={{ fontSize: 11, fill: "#888780" }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: "#b4b2a9" }} />
          <Radar name="Std Dev" dataKey="Std Dev" stroke="#185fa5" fill="#185fa5" fillOpacity={0.25} />
          <Radar name="Mean" dataKey="Mean" stroke="#1d9e75" fill="#1d9e75" fillOpacity={0.15} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e2e0d8" }} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Chart: Categorical breakdown ─────────────────────────────────────────────
function CategoricalChart({ columns }) {
  const catCols = columns.filter(c => c.type === "categorical" && c.top_values);
  const [selected, setSelected] = useState(catCols[0]?.name || "");
  const col = catCols.find(c => c.name === selected);

  const data = col
    ? Object.entries(col.top_values).map(([name, value]) => ({ name, value }))
    : [];

  if (catCols.length === 0) return null;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <SectionTitle style={{ margin: 0 }}>Category breakdown</SectionTitle>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #d3d1c7", background: "#fafaf8", color: "#2c2c2a" }}
        >
          {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 60, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1efe8" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#888780" }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#888780" }} width={55} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid #e2e0d8" }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Upload zone (reused) ──────────────────────────────────────────────────────
function UploadZone({ onResult }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      onResult(data, file);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onResult]);

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? "#378add" : "#d3d1c7"}`,
          borderRadius: 16, background: dragging ? "#e6f1fb" : "#fff",
          padding: "56px 32px", textAlign: "center", cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        {loading ? (
          <div>
            <div style={{ width: 36, height: 36, border: "3px solid #e6f1fb", borderTop: "3px solid #185fa5", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 13, color: "#888780" }}>Analysing…</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#2c2c2a", marginBottom: 6 }}>Drop your CSV or Excel file</div>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 18 }}>Up to 100,000 rows supported</div>
            <div style={{ display: "inline-block", background: "#185fa5", color: "#fff", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 500 }}>Browse files</div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      </div>
      {error && (
        <div style={{ background: "#fcebeb", border: "0.5px solid #f7c1c1", borderRadius: 10, padding: "12px 16px", marginTop: 12, color: "#a32d2d", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const ready = localStorage.getItem("statviz_ready");
  const saved = ready ? localStorage.getItem("statviz_result") : null;
  const savedName = ready ? localStorage.getItem("statviz_filename") : "";
  const [result, setResult] = useState(saved ? JSON.parse(saved) : null);
  const [filename, setFilename] = useState(savedName || "");
  const [rawRows, setRawRows] = useState([]);
  const navigate = useNavigate();

  const handleResult = useCallback((data, file) => {
    setResult(data);
    setFilename(file.name);
    localStorage.removeItem("statviz_ready");

    // Parse raw CSV for scatter plot
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",");
        const row = {};
        headers.forEach((h, i) => row[h] = vals[i]?.trim());
        return row;
      });
      setRawRows(rows);
    };
    reader.readAsText(file);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f1", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "0.5px solid #e2e0d8",
        padding: "14px 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#185fa5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>S</div>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em" }}>StatViz</span>
          <span style={{ fontSize: 12, color: "#888780", marginLeft: 4 }}>Charts Dashboard</span>
        </div>
        {result && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge color="green">{filename}</Badge>
            <button
              onClick={() => {
                localStorage.removeItem("statviz_ready");
                localStorage.removeItem("statviz_result");
                localStorage.removeItem("statviz_filename");
                navigate("/");
              }}
              style={{ background: "none", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#5f5e5a", cursor: "pointer" }}
            >
              ← New file
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {!result ? (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.03em", marginBottom: 6 }}>Charts Dashboard</h1>
            <p style={{ fontSize: 14, color: "#888780", marginBottom: 28 }}>Upload your dataset to instantly generate interactive charts and visualisations.</p>
            <UploadZone onResult={handleResult} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Summary row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge color="blue">{result.rows.toLocaleString()} rows</Badge>
              <Badge color="blue">{result.columns_count} columns</Badge>
              <Badge color="gray">{result.numeric_columns.length} numeric</Badge>
              <Badge color="gray">{result.categorical_columns.length} categorical</Badge>
            </div>

            {/* Charts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <MeansBarChart columns={result.columns} />
              <HistogramChart columns={result.columns} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ScatterPlot columns={result.columns} rawRows={rawRows} />
              <RadarOverview columns={result.columns} />
            </div>

            {result.categorical_columns.length > 0 && (
              <CategoricalChart columns={result.columns} />
            )}

          </div>
        )}
      </div>
    </div>
  );
}