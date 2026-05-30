import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function Badge({ children, color = "blue" }) {
  const colors = {
    blue:   { bg: "#e6f1fb", text: "#185fa5" },
    green:  { bg: "#eaf3de", text: "#3b6d11" },
    red:    { bg: "#fcebeb", text: "#a32d2d" },
    amber:  { bg: "#faeeda", text: "#854f0b" },
    gray:   { bg: "#f1efe8", text: "#5f5e5a" },
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

function ResultCard({ result }) {
  if (!result) return null;
  const isSignificant = result.significant;

  return (
    <div style={{
      background: isSignificant ? "#eaf3de" : "#faeeda",
      border: `0.5px solid ${isSignificant ? "#c0dd97" : "#fac775"}`,
      borderRadius: 12, padding: 20, marginTop: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{isSignificant ? "✅" : "⚠️"}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#2c2c2a" }}>{result.test}</span>
        <Badge color={isSignificant ? "green" : "amber"}>
          {isSignificant ? "Significant" : "Not Significant"}
        </Badge>
      </div>

      {/* Key stats */}
      {/* Cluster Sizes */}
{result?.cluster_sizes && (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2c2a", marginBottom: 8 }}>
      Cluster Sizes
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {Object.entries(result.cluster_sizes).map(([k, v]) => (
        <div
          key={k}
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#888780" }}>{k}: </span>
          <span style={{ fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
            {v} items
          </span>
        </div>
      ))}
    </div>
  </div>
)}

{/* PCA Explained Variance */}
{result?.explained_variance?.length > 0 && (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2c2a", marginBottom: 8 }}>
      Explained Variance per Component
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {result.explained_variance.map((v, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#888780" }}>PC{i + 1}: </span>
          <span style={{ fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
            {(v * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  </div>
)}

{/* PCA Loadings */}
{result?.loadings && (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2c2a", marginBottom: 8 }}>
      Feature Loadings
    </div>

    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 11,
        }}
      >
        <thead>
          <tr style={{ borderBottom: "0.5px solid #e2e0d8" }}>
            <th style={{ padding: "6px 10px", textAlign: "left", color: "#888780" }}>
              Feature
            </th>

            {result.loadings[Object.keys(result.loadings)[0]]?.map((_, i) => (
              <th
                key={i}
                style={{
                  padding: "6px 10px",
                  textAlign: "center",
                  color: "#888780",
                }}
              >
                PC{i + 1}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Object.entries(result.loadings).map(([feature, vals]) => (
            <tr key={feature} style={{ borderBottom: "0.5px solid #f1efe8" }}>
              <td
                style={{
                  padding: "6px 10px",
                  fontWeight: 500,
                  color: "#2c2c2a",
                }}
              >
                {feature}
              </td>

              {vals.map((v, i) => (
                <td
                  key={i}
                  style={{
                    padding: "6px 10px",
                    textAlign: "center",
                    fontFamily: "'DM Mono', monospace",
                    color: Math.abs(v) > 0.5 ? "#185fa5" : "#444441",
                    fontWeight: Math.abs(v) > 0.5 ? 600 : 400,
                  }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

      {/* Coefficients for regression */}
      {result.coefficients && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2c2a", marginBottom: 8 }}>Coefficients</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
              <span style={{ color: "#888780" }}>Intercept: </span>
              <span style={{ fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>{result.intercept}</span>
            </div>
            {Object.entries(result.coefficients).map(([k, v]) => (
              <div key={k} style={{ background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                <span style={{ color: "#888780" }}>{k}: </span>
                <span style={{ fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group summary for ANOVA */}
      {result.group_summary && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2c2a", marginBottom: 8 }}>Group Summary</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(result.group_summary).map(([group, stats]) => (
              <div key={group} style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <div style={{ fontWeight: 500, color: "#2c2c2a", marginBottom: 4 }}>{group}</div>
                <div style={{ color: "#888780" }}>n={stats.n} · mean={stats.mean} · sd={stats.std}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plain English interpretation */}
      <div style={{
        background: "#fff", borderRadius: 8, padding: "12px 14px",
        fontSize: 13, color: "#2c2c2a", lineHeight: 1.6,
        borderLeft: "3px solid #185fa5",
      }}>
        💡 {result.interpretation}
      </div>
    </div>
  );
}

// ── T-Test Panel ──────────────────────────────────────────────────────────────
function TTestPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [testType, setTestType] = useState("one_sample");
  const [col1, setCol1] = useState(numCols[0]?.name || "");
  const [col2, setCol2] = useState(numCols[1]?.name || "");
  const [popMean, setPopMean] = useState("0");

  const run = () => {
    const col1Data = columns.find(c => c.name === col1);
    const col2Data = columns.find(c => c.name === col2);

    onRun("/stats/ttest", {
      test_type: testType,
      col1: col1Data?.raw_data || generateFromStats(col1Data),
      col2: testType !== "one_sample" ? (col2Data?.raw_data || generateFromStats(col2Data)) : [],
      pop_mean: parseFloat(popMean),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Test type</label>
        <select value={testType} onChange={e => setTestType(e.target.value)} style={selectStyle}>
          <option value="one_sample">One-Sample T-Test</option>
          <option value="two_sample">Two-Sample Independent T-Test</option>
          <option value="paired">Paired T-Test</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>
          {testType === "one_sample" ? "Column" : "Column 1 (Group A)"}
        </label>
        <select value={col1} onChange={e => setCol1(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      {testType === "one_sample" ? (
        <div>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Population mean (H₀)</label>
          <input type="number" value={popMean} onChange={e => setPopMean(e.target.value)} style={inputStyle} />
        </div>
      ) : (
        <div>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column 2 (Group B)</label>
          <select value={col2} onChange={e => setCol2(e.target.value)} style={selectStyle}>
            {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}
      <button onClick={run} style={btnStyle}>Run T-Test →</button>
    </div>
  );
}

// ── ANOVA Panel ───────────────────────────────────────────────────────────────
function AnovaPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const catCols = columns.filter(c => c.type === "categorical");
  const [valueCol, setValueCol] = useState(numCols[0]?.name || "");
  const [groupCol, setGroupCol] = useState(catCols[0]?.name || "");

  const run = () => {
    const vCol = columns.find(c => c.name === valueCol);
    const gCol = columns.find(c => c.name === groupCol);
    if (!vCol || !gCol) return;

    const groups = {};
    const topVals = Object.keys(gCol.top_values || {});
    topVals.forEach(group => {
      groups[group] = generateFromStats(vCol);
    });

    onRun("/stats/anova", { groups });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Value column (numeric)</label>
        <select value={valueCol} onChange={e => setValueCol(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Group column (categorical)</label>
        <select value={groupCol} onChange={e => setGroupCol(e.target.value)} style={selectStyle}>
          {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <button onClick={run} style={btnStyle}>Run ANOVA →</button>
    </div>
  );
}

// ── Chi-Square Panel ──────────────────────────────────────────────────────────
function ChiSquarePanel({ columns, onRun }) {
  const catCols = columns.filter(c => c.type === "categorical");
  const [col1, setCol1] = useState(catCols[0]?.name || "");
  const [col2, setCol2] = useState(catCols[1]?.name || catCols[0]?.name || "");

  const run = () => {
    const c1 = columns.find(c => c.name === col1);
    const c2 = columns.find(c => c.name === col2);
    const vals1 = Object.entries(c1?.top_values || {}).flatMap(([k, v]) => Array(v).fill(k));
    const vals2 = Object.entries(c2?.top_values || {}).flatMap(([k, v]) => Array(v).fill(k));
    const minLen = Math.min(vals1.length, vals2.length);
    onRun("/stats/chisquare", { col1: vals1.slice(0, minLen), col2: vals2.slice(0, minLen) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column 1 (categorical)</label>
        <select value={col1} onChange={e => setCol1(e.target.value)} style={selectStyle}>
          {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column 2 (categorical)</label>
        <select value={col2} onChange={e => setCol2(e.target.value)} style={selectStyle}>
          {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <button onClick={run} style={btnStyle}>Run Chi-Square →</button>
    </div>
  );
}

// ── Correlation Panel ─────────────────────────────────────────────────────────
function CorrelationPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [col1, setCol1] = useState(numCols[0]?.name || "");
  const [col2, setCol2] = useState(numCols[1]?.name || "");
  const [method, setMethod] = useState("pearson");

  const run = () => {
    const c1 = columns.find(c => c.name === col1);
    const c2 = columns.find(c => c.name === col2);
    onRun("/stats/correlation", {
      col1: generateFromStats(c1),
      col2: generateFromStats(c2),
      method,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Method</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={selectStyle}>
          <option value="pearson">Pearson (linear)</option>
          <option value="spearman">Spearman (rank)</option>
          <option value="kendall">Kendall Tau</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column 1</label>
        <select value={col1} onChange={e => setCol1(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column 2</label>
        <select value={col2} onChange={e => setCol2(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <button onClick={run} style={btnStyle}>Run Correlation →</button>
    </div>
  );
}

// ── Regression Panel ──────────────────────────────────────────────────────────
function RegressionPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [yCol, setYCol] = useState(numCols[0]?.name || "");
  const [xCols, setXCols] = useState([numCols[1]?.name || ""]);

  const toggleX = (name) => {
    setXCols(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  };

  const run = () => {
    const yData = generateFromStats(columns.find(c => c.name === yCol));
    const xData = xCols.map(name => generateFromStats(columns.find(c => c.name === name)));
    const X = yData.map((_, i) => xCols.map((_, j) => xData[j][i]));
    onRun("/stats/regression", {
      X: X.map(row => row.length === 1 ? row[0] : row),
      y: yData,
      feature_names: xCols,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Target column (Y)</label>
        <select value={yCol} onChange={e => setYCol(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Predictor columns (X) — select one or more</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {numCols.filter(c => c.name !== yCol).map(c => (
            <div
              key={c.name}
              onClick={() => toggleX(c.name)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12,
                cursor: "pointer", fontWeight: 500,
                background: xCols.includes(c.name) ? "#185fa5" : "#f1efe8",
                color: xCols.includes(c.name) ? "#fff" : "#5f5e5a",
                border: `0.5px solid ${xCols.includes(c.name) ? "#185fa5" : "#d3d1c7"}`,
              }}
            >
              {c.name}
            </div>
          ))}
        </div>
      </div>
      <button onClick={run} style={btnStyle}>Run Regression →</button>
    </div>
  );
}

// ── Non-parametric Panel ──────────────────────────────────────────────────────
function NonParametricPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const catCols = columns.filter(c => c.type === "categorical");
  const [testType, setTestType] = useState("mannwhitney");
  const [col1, setCol1] = useState(numCols[0]?.name || "");
  const [col2, setCol2] = useState(numCols[1]?.name || "");
  const [groupCol, setGroupCol] = useState(catCols[0]?.name || "");

  const run = () => {
    const c1 = columns.find(c => c.name === col1);
    const c2 = columns.find(c => c.name === col2);

    if (testType === "kruskalwallis") {
      const gCol = columns.find(c => c.name === groupCol);
      const groups = {};
      Object.keys(gCol?.top_values || {}).forEach(g => {
        groups[g] = generateFromStats(c1);
      });
      onRun("/stats/nonparametric", { test_type: testType, col1: [], col2: [], groups });
    } else {
      onRun("/stats/nonparametric", {
        test_type: testType,
        col1: generateFromStats(c1),
        col2: generateFromStats(c2),
        groups: {},
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Test type</label>
        <select value={testType} onChange={e => setTestType(e.target.value)} style={selectStyle}>
          <option value="mannwhitney">Mann-Whitney U Test</option>
          <option value="wilcoxon">Wilcoxon Signed-Rank Test</option>
          <option value="kruskalwallis">Kruskal-Wallis Test</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>
          {testType === "kruskalwallis" ? "Value column" : "Column 1"}
        </label>
        <select value={col1} onChange={e => setCol1(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      {testType !== "kruskalwallis" ? (
        <div>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column 2</label>
          <select value={col2} onChange={e => setCol2(e.target.value)} style={selectStyle}>
            {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Group column</label>
          <select value={groupCol} onChange={e => setGroupCol(e.target.value)} style={selectStyle}>
            {catCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}
      <button onClick={run} style={btnStyle}>Run Test →</button>
    </div>
  );
}

// ── Helper: generate data from stats ─────────────────────────────────────────
function generateFromStats(col) {
  if (!col) return [];
  const { mean = 0, std = 1, count = 50 } = col;
  return Array.from({ length: count }, () => mean + std * (Math.random() * 2 - 1) * 1.5);
}

// ── Styles ────────────────────────────────────────────────────────────────────
const selectStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "0.5px solid #d3d1c7", borderRadius: 8,
  background: "#fafaf8", color: "#2c2c2a", outline: "none",
};

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "0.5px solid #d3d1c7", borderRadius: 8,
  background: "#fafaf8", color: "#2c2c2a", outline: "none",
  boxSizing: "border-box",
};

const btnStyle = {
  background: "#185fa5", color: "#fff", border: "none",
  borderRadius: 8, padding: "10px 20px", fontSize: 13,
  fontWeight: 500, cursor: "pointer", marginTop: 4,
};

// ── Time Series Panel ─────────────────────────────────────────────────────────
function TimeSeriesPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [col, setCol] = useState(numCols[0]?.name || "");
  const [window, setWindow] = useState("3");

  const run = () => {
    const colData = columns.find(c => c.name === col);
    onRun("/stats/timeseries", {
      col: generateFromStats(colData),
      window: parseInt(window),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column</label>
        <select value={col} onChange={e => setCol(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Moving average window</label>
        <select value={window} onChange={e => setWindow(e.target.value)} style={selectStyle}>
          <option value="3">3 periods</option>
          <option value="5">5 periods</option>
          <option value="7">7 periods</option>
          <option value="10">10 periods</option>
        </select>
      </div>
      <button onClick={run} style={btnStyle}>Run Time Series →</button>
    </div>
  );
}

// ── Probability Panel ─────────────────────────────────────────────────────────
function ProbabilityPanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [col, setCol] = useState(numCols[0]?.name || "");
  const [distType, setDistType] = useState("normal");

  const run = () => {
    const colData = columns.find(c => c.name === col);
    onRun("/stats/probability", {
      col: generateFromStats(colData),
      dist_type: distType,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Distribution</label>
        <select value={distType} onChange={e => setDistType(e.target.value)} style={selectStyle}>
          <option value="normal">Normal Distribution</option>
          <option value="binomial">Binomial Distribution</option>
          <option value="poisson">Poisson Distribution</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Column</label>
        <select value={col} onChange={e => setCol(e.target.value)} style={selectStyle}>
          {numCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <button onClick={run} style={btnStyle}>Fit Distribution →</button>
    </div>
  );
}

// ── Multivariate Panel ────────────────────────────────────────────────────────
function MultivariatePanel({ columns, onRun }) {
  const numCols = columns.filter(c => c.type === "numeric");
  const [method, setMethod] = useState("pca");
  const [selectedCols, setSelectedCols] = useState(numCols.slice(0, 3).map(c => c.name));
  const [nComponents, setNComponents] = useState("2");
  const [nClusters, setNClusters] = useState("3");

  const toggleCol = (name) => {
    setSelectedCols(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const run = () => {
    const colsData = selectedCols.map(name => generateFromStats(columns.find(c => c.name === name)));
    const n = colsData[0]?.length || 50;
    const X = Array.from({ length: n }, (_, i) => selectedCols.map((_, j) => colsData[j][i]));
    onRun("/stats/multivariate", {
      method,
      X,
      feature_names: selectedCols,
      n_components: parseInt(nComponents),
      n_clusters: parseInt(nClusters),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Method</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={selectStyle}>
          <option value="pca">PCA — Dimensionality Reduction</option>
          <option value="kmeans">K-Means Clustering</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Select columns (min 2)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {numCols.map(c => (
            <div
              key={c.name}
              onClick={() => toggleCol(c.name)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12,
                cursor: "pointer", fontWeight: 500,
                background: selectedCols.includes(c.name) ? "#185fa5" : "#f1efe8",
                color: selectedCols.includes(c.name) ? "#fff" : "#5f5e5a",
                border: `0.5px solid ${selectedCols.includes(c.name) ? "#185fa5" : "#d3d1c7"}`,
              }}
            >
              {c.name}
            </div>
          ))}
        </div>
      </div>
      {method === "pca" && (
        <div>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Number of components</label>
          <select value={nComponents} onChange={e => setNComponents(e.target.value)} style={selectStyle}>
            <option value="2">2 components</option>
            <option value="3">3 components</option>
          </select>
        </div>
      )}
      {method === "kmeans" && (
        <div>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Number of clusters</label>
          <select value={nClusters} onChange={e => setNClusters(e.target.value)} style={selectStyle}>
            <option value="2">2 clusters</option>
            <option value="3">3 clusters</option>
            <option value="4">4 clusters</option>
            <option value="5">5 clusters</option>
          </select>
        </div>
      )}
      <button onClick={run} style={btnStyle}>Run {method === "pca" ? "PCA" : "K-Means"} →</button>
    </div>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [

  { id: "ttest", label: "T-Tests", icon: "🔬", desc: "Compare means — one sample, two sample, paired" },
  { id: "anova", label: "ANOVA", icon: "📊", desc: "Compare means across multiple groups" },
  { id: "chisquare", label: "Chi-Square", icon: "χ²", desc: "Test association between categorical variables" },
  { id: "correlation", label: "Correlation", icon: "🔗", desc: "Measure relationship strength — Pearson, Spearman, Kendall" },
  { id: "regression", label: "Regression", icon: "📈", desc: "Predict values — simple and multiple linear regression" },
  { id: "nonparametric", label: "Non-Parametric", icon: "🔄", desc: "Distribution-free tests — Mann-Whitney, Wilcoxon, Kruskal-Wallis" },
  { id: "timeseries", label: "Time Series", icon: "⏱️", desc: "Trend, moving average, stationarity analysis" },
  { id: "probability", label: "Probability", icon: "🎲", desc: "Fit distributions — Normal, Binomial, Poisson" },
  { id: "multivariate", label: "Multivariate", icon: "🧠", desc: "PCA dimensionality reduction and K-Means clustering" },

];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const navigate = useNavigate();
  const saved = localStorage.getItem("statviz_result");
  const result = saved ? JSON.parse(saved) : null;

  const [activeCategory, setActiveCategory] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async (endpoint, payload) => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Test failed");
      setTestResult(data);
    } catch (e) {
      alert("Test failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

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
          <span style={{ fontSize: 12, color: "#888780", marginLeft: 4 }}>Statistics Module</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
  <button onClick={() => navigate(-1)} style={{ background: "none", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#5f5e5a", cursor: "pointer" }}>
    ← Back
  </button>
  <button onClick={() => navigate("/")} style={{ background: "none", border: "0.5px solid #d3d1c7", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#5f5e5a", cursor: "pointer" }}>
    📂 Upload
  </button>
  <button onClick={() => navigate("/dashboard")} style={{ background: "#185fa5", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
    📊 Charts
  </button>
</div>

      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {!result ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#2c2c2a", marginBottom: 8 }}>No dataset loaded</div>
            <div style={{ fontSize: 13, color: "#888780", marginBottom: 20 }}>Upload a file first to run statistical tests</div>
            <button onClick={() => navigate("/")} style={btnStyle}>Upload Dataset →</button>
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em", marginBottom: 4 }}>
              Statistics Module
            </h1>
            <p style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>
              Running on: <strong>{result.filename}</strong> — {result.rows} rows, {result.columns_count} columns
            </p>

            {/* Category grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
              {CATEGORIES.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setTestResult(null); }}
                  style={{
                    background: activeCategory === cat.id ? "#185fa5" : "#fff",
                    border: `0.5px solid ${activeCategory === cat.id ? "#185fa5" : "#e2e0d8"}`,
                    borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{cat.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeCategory === cat.id ? "#fff" : "#2c2c2a", marginBottom: 3 }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: activeCategory === cat.id ? "rgba(255,255,255,0.8)" : "#888780", lineHeight: 1.4 }}>{cat.desc}</div>
                </div>
              ))}
            </div>

            {/* Test panel */}
            {activeCategory && (
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2c2c2a", marginBottom: 16 }}>
                  {CATEGORIES.find(c => c.id === activeCategory)?.icon} {CATEGORIES.find(c => c.id === activeCategory)?.label}
                </div>

                {activeCategory === "ttest" && <TTestPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "anova" && <AnovaPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "chisquare" && <ChiSquarePanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "correlation" && <CorrelationPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "regression" && <RegressionPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "nonparametric" && <NonParametricPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "timeseries" && <TimeSeriesPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "probability" && <ProbabilityPanel columns={result.columns} onRun={runTest} />}
                {activeCategory === "multivariate" && <MultivariatePanel columns={result.columns} onRun={runTest} />}

                {loading && (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ width: 28, height: 28, border: "3px solid #e6f1fb", borderTop: "3px solid #185fa5", borderRadius: "50%", margin: "0 auto 8px", animation: "spin 0.8s linear infinite" }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{ fontSize: 12, color: "#888780" }}>Running test…</div>
                  </div>
                )}

                <ResultCard result={testResult} />
              </Card>
            )}

            {/* Stats reference */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2c2c2a", marginBottom: 12 }}>📖 Quick Reference — When to use which test?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["One-Sample T-Test", "Compare sample mean to known value"],
                  ["Two-Sample T-Test", "Compare means of two independent groups"],
                  ["Paired T-Test", "Compare same group before/after"],
                  ["One-Way ANOVA", "Compare means of 3+ groups"],
                  ["Chi-Square", "Test if two categorical variables are related"],
                  ["Pearson Correlation", "Linear relationship between two numeric variables"],
                  ["Spearman Correlation", "Monotonic relationship, non-normal data"],
                  ["Linear Regression", "Predict a numeric outcome from predictors"],
                  ["Mann-Whitney", "Non-parametric alternative to two-sample t-test"],
                  ["Kruskal-Wallis", "Non-parametric alternative to one-way ANOVA"],
                ].map(([test, desc]) => (
                  <div key={test} style={{ background: "#f7f6f1", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#2c2c2a" }}>{test}</div>
                    <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}