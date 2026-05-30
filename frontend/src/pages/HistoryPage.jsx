import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Badge({ children, color = "blue" }) {
  const colors = {
    blue:  { bg: "#e6f1fb", text: "#185fa5" },
    green: { bg: "#eaf3de", text: "#3b6d11" },
    gray:  { bg: "#f1efe8", text: "#5f5e5a" },
    red:   { bg: "#fcebeb", text: "#a32d2d" },
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

export default function HistoryPage({ user }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setAnalyses(data || []);
    setLoading(false);
  };

  const loadAnalysis = (analysis) => {
    localStorage.setItem("statviz_result", JSON.stringify(analysis.result));
    localStorage.setItem("statviz_filename", analysis.filename);
    localStorage.setItem("statviz_ready", "yes");
    navigate("/");
  };

  const deleteAnalysis = async (id) => {
    setDeleting(id);
    await supabase.from("analyses").delete().eq("id", id);
    setAnalyses(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate("/auth");
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
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#185fa5",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 14,
          }}>S</div>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em" }}>StatViz</span>
          <span style={{ fontSize: 12, color: "#888780", marginLeft: 4 }}>History</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#888780" }}>{user?.email}</span>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "#185fa5", color: "#fff", border: "none",
              borderRadius: 8, padding: "7px 14px", fontSize: 12,
              fontWeight: 500, cursor: "pointer",
            }}
          >
            + New Analysis
          </button>
          <button
            onClick={handleSignOut}
            style={{
              background: "none", border: "0.5px solid #d3d1c7",
              borderRadius: 8, padding: "6px 14px", fontSize: 12,
              color: "#5f5e5a", cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Your analyses
        </h1>
        <p style={{ fontSize: 13, color: "#888780", marginBottom: 28 }}>
          Click any analysis to reload it instantly.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid #e6f1fb",
              borderTop: "3px solid #185fa5", borderRadius: "50%",
              margin: "0 auto 12px", animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 13, color: "#888780" }}>Loading history…</div>
          </div>
        ) : analyses.length === 0 ? (
          <div style={{
            background: "#fff", border: "0.5px solid #e2e0d8",
            borderRadius: 14, padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#2c2c2a", marginBottom: 6 }}>No analyses yet</div>
            <div style={{ fontSize: 13, color: "#888780", marginBottom: 20 }}>Upload a file to get started</div>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "#185fa5", color: "#fff", border: "none",
                borderRadius: 8, padding: "10px 24px", fontSize: 13,
                fontWeight: 500, cursor: "pointer",
              }}
            >
              Upload first file →
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                style={{
                  background: "#fff", border: "0.5px solid #e2e0d8",
                  borderRadius: 12, padding: "16px 20px",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12,
                }}
              >
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => loadAnalysis(analysis)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#2c2c2a" }}>
                      {analysis.filename}
                    </span>
                    <Badge color="green">Ready</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge color="blue">{analysis.rows?.toLocaleString()} rows</Badge>
                    <Badge color="gray">{analysis.columns_count} columns</Badge>
                    <span style={{ fontSize: 11, color: "#b4b2a9", fontFamily: "'DM Mono', monospace" }}>
                      {formatDate(analysis.created_at)}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => loadAnalysis(analysis)}
                    style={{
                      background: "#e6f1fb", color: "#185fa5", border: "none",
                      borderRadius: 8, padding: "7px 14px", fontSize: 12,
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Load →
                  </button>
                  <button
                    onClick={() => deleteAnalysis(analysis.id)}
                    disabled={deleting === analysis.id}
                    style={{
                      background: "#fcebeb", color: "#a32d2d", border: "none",
                      borderRadius: 8, padding: "7px 14px", fontSize: 12,
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    {deleting === analysis.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}