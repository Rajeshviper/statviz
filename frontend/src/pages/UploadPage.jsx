import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";



const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toFixed(d));
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);

function Badge({ children, color = "blue" }) {
  const colors = {
    blue:   { bg: "#e6f1fb", text: "#185fa5", border: "#b5d4f4" },
    green:  { bg: "#eaf3de", text: "#3b6d11", border: "#c0dd97" },
    amber:  { bg: "#faeeda", text: "#854f0b", border: "#fac775" },
    red:    { bg: "#fcebeb", text: "#a32d2d", border: "#f7c1c1" },
    gray:   { bg: "#f1efe8", text: "#5f5e5a", border: "#d3d1c7" },
  };
  const c = colors[color];
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 99, fontSize: 11, padding: "2px 10px", fontWeight: 500,
      letterSpacing: "0.02em",
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "#fff", border: "0.5px solid #e2e0d8",
      borderRadius: 12, padding: "14px 18px",
      borderLeft: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ fontSize: 11, color: "#888780", marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#b4b2a9", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ColumnCard({ col }) {
  const [open, setOpen] = useState(false);
  const isNum = col.type === "numeric";

  return (
    <div style={{
      background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 12,
      overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 13,
            background: isNum ? "#e6f1fb" : "#eaf3de",
            color: isNum ? "#185fa5" : "#3b6d11",
          }}>
            {isNum ? "∑" : "Aa"}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#2c2c2a" }}>{col.name}</div>
            <div style={{ fontSize: 11, color: "#888780", fontFamily: "'DM Mono', monospace" }}>{col.dtype}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {col.missing > 0 && <Badge color="amber">{col.missing_pct}% missing</Badge>}
          {col.outliers_count > 0 && <Badge color="red">{col.outliers_count} outliers</Badge>}
          {col.is_normal === true && <Badge color="green">normal</Badge>}
          {col.is_normal === false && <Badge color="gray">non-normal</Badge>}
          <span style={{ color: "#b4b2a9", fontSize: 16, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: "0.5px solid #f1efe8", padding: "14px 16px", background: "#fafaf8" }}>
          {isNum ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                ["Mean", fmt(col.mean)], ["Median", fmt(col.median)],
                ["Std Dev", fmt(col.std)], ["Variance", fmt(col.variance)],
                ["Min", fmt(col.min)], ["Max", fmt(col.max)],
                ["Q1", fmt(col.q1)], ["Q3", fmt(col.q3)],
                ["IQR", fmt(col.iqr)], ["Range", fmt(col.range)],
                ["Skewness", fmt(col.skewness)], ["Kurtosis", fmt(col.kurtosis)],
              ].map(([l, v]) => (
                <div key={l} style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", border: "0.5px solid #e2e0d8" }}>
                  <div style={{ fontSize: 10, color: "#888780", fontFamily: "'DM Mono', monospace" }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#2c2c2a" }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 8 }}>Top values</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(col.top_values || {}).map(([k, v]) => (
                  <div key={k} style={{
                    background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 8,
                    padding: "4px 10px", fontSize: 12, color: "#2c2c2a",
                  }}>
                    <span style={{ color: "#888780" }}>{k}</span>
                    <span style={{ marginLeft: 6, fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isNum && col.histogram && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 6 }}>Distribution</div>
              <MiniHistogram counts={col.histogram.counts} bins={col.histogram.bins} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniHistogram({ counts, bins }) {
  const max = Math.max(...counts);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
      {counts.map((c, i) => (
        <div key={i} title={`${bins[i]}–${bins[i + 1]}: ${c}`} style={{
          flex: 1, background: "#378add",
          height: `${(c / max) * 100}%`,
          borderRadius: "3px 3px 0 0", minHeight: 2, opacity: 0.85,
          transition: "opacity 0.15s", cursor: "default",
        }}
          onMouseEnter={e => e.target.style.opacity = 1}
          onMouseLeave={e => e.target.style.opacity = 0.85}
        />
      ))}
    </div>
  );
}

function CorrMatrix({ correlation }) {
  if (!correlation) return null;
  const { columns, matrix } = correlation;

  const cellColor = (v) => {
    if (v == null) return "#f1efe8";
    const abs = Math.abs(v);
    if (abs > 0.8) return v > 0 ? "#185fa5" : "#a32d2d";
    if (abs > 0.6) return v > 0 ? "#378add" : "#d85a30";
    if (abs > 0.4) return v > 0 ? "#85b7eb" : "#f0997b";
    if (abs > 0.2) return v > 0 ? "#b5d4f4" : "#f5c4b3";
    return "#f1efe8";
  };
  const textColor = (v) => {
    if (v == null) return "#888780";
    return Math.abs(v) > 0.6 ? "#fff" : "#2c2c2a";
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 3 }}>
        <thead>
          <tr>
            <td style={{ width: 80 }} />
            {columns.map(c => (
              <th key={c} style={{
                fontSize: 10, fontWeight: 500, color: "#888780",
                textAlign: "center", padding: "0 4px 6px",
                fontFamily: "'DM Mono', monospace", maxWidth: 70,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td style={{
                fontSize: 10, color: "#888780", textAlign: "right",
                paddingRight: 8, fontFamily: "'DM Mono', monospace",
                maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis",
              }}>{columns[i]}</td>
              {row.map((v, j) => (
                <td key={j} style={{
                  background: cellColor(v), color: textColor(v),
                  width: 52, height: 40, textAlign: "center",
                  fontSize: 11, fontWeight: 500, borderRadius: 6,
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {v != null ? v.toFixed(2) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("overview");
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const inputRef = useRef();
  const navigate = useNavigate();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setResult(data);
      setTab("overview");
      localStorage.setItem("statviz_result", JSON.stringify(data));  // ← add this
      localStorage.setItem("statviz_filename", file.name);           // ← add this
      localStorage.setItem("statviz_ready", "yes");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("analyses").insert({
          user_id: user.id,
          filename: file.name,
          rows: data.rows,
          columns_count: data.columns_count,
          result: data,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateInsights = async () => {
  if (!apiKey) {
    alert("Please enter your Claude API key first!");
    return;
  }

  setInsightsLoading(true);
  setInsights(null);

  try {
    const res = await fetch(`${API_URL}/ai/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...result, api_key: apiKey }),
    });

    const data = await res.json();
    console.log("AI response:", data);
    if (!res.ok) throw new Error(data.detail || "Failed");
    if (!data.insights) throw new Error("No insights returned from server");
    setInsights(data.insights);
  } catch (e) {
    alert("AI insights failed: " + e.message);
  } finally {
    setInsightsLoading(false);
  }
};

const onDrop = (e) => {
  e.preventDefault();
  setDragging(false);

  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
};

  const numCols = result?.columns?.filter(c => c.type === "numeric") || [];

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
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#185fa5",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 14,
          }}>S</div>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em" }}>StatViz</span>
          <button
          onClick={() => navigate("/history")}
          style={{
            background: "none", border: "0.5px solid #d3d1c7",
            borderRadius: 8, padding: "6px 14px", fontSize: 12,
            color: "#5f5e5a", cursor: "pointer", marginLeft: 8,
            }}
            >
              📋 History
              </button>
          <button
          onClick={() => navigate("/stats")}
          style={{
            background: "none", border: "0.5px solid #d3d1c7",
            borderRadius: 8, padding: "6px 14px", fontSize: 12,
            color: "#5f5e5a", cursor: "pointer", marginLeft: 8,
            }}
            >
              
  🔬 Statistics
</button>

        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {result && (
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "#185fa5", color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 16px", fontSize: 12,
                fontWeight: 500, cursor: "pointer",
              }}
            >
              Charts Dashboard →
            </button>
          )}
          {result && (
            <button
              onClick={() => { setResult(null); setError(null); }}
              style={{
                background: "none", border: "0.5px solid #d3d1c7", borderRadius: 8,
                padding: "6px 14px", fontSize: 12, color: "#5f5e5a", cursor: "pointer",
              }}
            >
              ← Upload new file
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* Upload zone */}
        {!result && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.03em", marginBottom: 6 }}>
              Analyse your data
            </h1>
            <p style={{ fontSize: 15, color: "#888780", marginBottom: 32 }}>
              Upload a CSV or Excel file and get instant statistical analysis, visualisations, and insights.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current.click()}
              style={{
                border: `2px dashed ${dragging ? "#378add" : "#d3d1c7"}`,
                borderRadius: 16, background: dragging ? "#e6f1fb" : "#fff",
                padding: "56px 32px", textAlign: "center", cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#2c2c2a", marginBottom: 6 }}>
                Drop your file here
              </div>
              <div style={{ fontSize: 13, color: "#888780", marginBottom: 20 }}>
                Supports CSV, XLSX, XLS — up to 100,000 rows
              </div>
              <div style={{
                display: "inline-block", background: "#185fa5", color: "#fff",
                borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 500,
              }}>
                Browse files
              </div>
              <input
                ref={inputRef} type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: "#b4b2a9", textAlign: "center" }}>
              No file? Try downloading a sample from{" "}
              <a href="https://www.kaggle.com/datasets" target="_blank" rel="noreferrer"
                style={{ color: "#378add", textDecoration: "none" }}>Kaggle Datasets</a>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 40, height: 40, border: "3px solid #e6f1fb",
              borderTop: "3px solid #185fa5", borderRadius: "50%",
              margin: "0 auto 16px", animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 14, color: "#888780" }}>Analysing your dataset…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#fcebeb", border: "0.5px solid #f7c1c1",
            borderRadius: 12, padding: "14px 18px", marginTop: 16,
            color: "#a32d2d", fontSize: 13,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em", margin: 0 }}>
                  {result.filename}
                </h2>
                <Badge color="green">Ready</Badge>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge color="blue">{result.rows.toLocaleString()} rows</Badge>
                <Badge color="blue">{result.columns_count} columns</Badge>
                <Badge color="gray">{result.numeric_columns.length} numeric</Badge>
                <Badge color="gray">{result.categorical_columns.length} categorical</Badge>
                {result.total_missing > 0 && <Badge color="amber">{result.total_missing} missing values</Badge>}
                {result.duplicate_rows > 0 && <Badge color="red">{result.duplicate_rows} duplicates</Badge>}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "0.5px solid #e2e0d8" }}>
              {["overview", "columns", "correlation", "preview"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: "none", border: "none", padding: "8px 16px",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  color: tab === t ? "#185fa5" : "#888780",
                  fontWeight: tab === t ? 500 : 400,
                  borderBottom: tab === t ? "2px solid #185fa5" : "2px solid transparent",
                  marginBottom: -1, transition: "all 0.15s", borderRadius: 0,
                }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === "overview" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  <StatCard label="TOTAL ROWS" value={result.rows.toLocaleString()} accent="#185fa5" />
                  <StatCard label="COLUMNS" value={result.columns_count} accent="#1d9e75" />
                  <StatCard label="MISSING VALUES" value={result.total_missing} accent={result.total_missing > 0 ? "#ba7517" : "#3b6d11"} sub={result.total_missing > 0 ? "needs attention" : "clean dataset"} />
                  <StatCard label="DUPLICATE ROWS" value={result.duplicate_rows} accent={result.duplicate_rows > 0 ? "#a32d2d" : "#3b6d11"} />
                </div>

                {numCols.length > 0 && (
                  <div style={{ background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#2c2c2a", marginBottom: 14 }}>Numeric columns summary</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "0.5px solid #e2e0d8" }}>
                            {["Column", "Mean", "Median", "Std Dev", "Min", "Max", "Missing", "Outliers"].map(h => (
                              <th key={h} style={{ padding: "6px 12px", textAlign: "left", color: "#888780", fontWeight: 500, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {numCols.map((col, i) => (
                            <tr key={i} style={{ borderBottom: "0.5px solid #f1efe8" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 500, color: "#2c2c2a" }}>{col.name}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: "#444441" }}>{fmt(col.mean)}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: "#444441" }}>{fmt(col.median)}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: "#444441" }}>{fmt(col.std)}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: "#444441" }}>{fmt(col.min)}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: "#444441" }}>{fmt(col.max)}</td>
                              <td style={{ padding: "8px 12px" }}>{col.missing > 0 ? <Badge color="amber">{pct(col.missing_pct)}</Badge> : <Badge color="green">0</Badge>}</td>
                              <td style={{ padding: "8px 12px" }}>{col.outliers_count > 0 ? <Badge color="red">{col.outliers_count}</Badge> : <Badge color="green">0</Badge>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Columns tab */}
            {tab === "columns" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.columns.map((col, i) => <ColumnCard key={i} col={col} />)}
              </div>
            )}

            {/* Correlation tab */}
            {tab === "correlation" && (
              <div style={{ background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 12, padding: 24 }}>
                {result.correlation ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#2c2c2a", marginBottom: 6 }}>Pearson correlation matrix</div>
                    <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>
                      Values range from −1 (perfect negative) to +1 (perfect positive). Blue = positive, red = negative.
                    </div>
                    <CorrMatrix correlation={result.correlation} />
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 13 }}>
                    Need at least 2 numeric columns for correlation analysis.
                  </div>
                )}
              </div>
            )}

            {/* Preview tab */}
            {tab === "preview" && (
              <div style={{ background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 12, padding: 20, overflowX: "auto" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#2c2c2a", marginBottom: 14 }}>First 5 rows</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid #e2e0d8" }}>
                      {result.columns.map(c => (
                        <th key={c.name} style={{ padding: "6px 12px", textAlign: "left", color: "#888780", fontWeight: 500, fontFamily: "'DM Mono', monospace", fontSize: 10, whiteSpace: "nowrap" }}>
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "0.5px solid #f1efe8" }}>
                        {result.columns.map(c => (
                          <td key={c.name} style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: "#444441", whiteSpace: "nowrap" }}>
                            {row[c.name] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Action buttons */}
            {/* AI Insights */}
            <div style={{ marginTop: 24, background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2c2c2a", marginBottom: 4 }}>🤖 AI Insights</div>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 14 }}>Get Claude AI to analyse your data and generate insights</div>
              {/* API Key input */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                type="password"
                placeholder="Enter your Claude API key (sk-ant-...)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{
                  flex: 1, padding: "9px 14px", fontSize: 12,border: "0.5px solid #d3d1c7", borderRadius: 8,background: "#fafaf8", color: "#2c2c2a", outline: "none",
                }}
                />
                <button
                onClick={generateInsights}
                disabled={insightsLoading}
                style={{
                  background: insightsLoading ? "#b5d4f4" : "#185fa5",
                  color: "#fff", border: "none", borderRadius: 8,padding: "9px 18px", fontSize: 12, fontWeight: 500,
                  cursor: insightsLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
                >
                  {insightsLoading ? "Analysing..." : "✨ Generate Insights"}
                  </button>
                  </div>
                  
                  {/* Insights output */}
                  {insights && (
                    <div style={{
                      background: "#f7f6f1", borderRadius: 10, padding: 16,
                      fontSize: 13, color: "#2c2c2a", lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      }}>
                        {insights}
                        </div>
                      )}
                      </div>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 12 }}>
              <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "#185fa5", color: "#fff", border: "none",
                borderRadius: 10, padding: "13px 36px", fontSize: 14,
                fontWeight: 500, cursor: "pointer", letterSpacing: "-0.01em",
              }}
              >
                View Charts Dashboard →
                </button>
                
                <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_URL}/export/pdf`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(result),
        });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `statviz_${result.filename.replace(/\.[^/.]+$/, "")}_report.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert("PDF export failed: " + e.message);
      }
    }}
    style={{
      background: "#fff", color: "#185fa5",
      border: "1.5px solid #185fa5",
      borderRadius: 10, padding: "13px 36px", fontSize: 14,
      fontWeight: 500, cursor: "pointer", letterSpacing: "-0.01em",
      }}
      >
        ↓ Download PDF Report
        </button>
        </div>
        
        </div>
        )}
      </div>
    </div>
  );
}