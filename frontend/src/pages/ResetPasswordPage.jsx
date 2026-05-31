import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  const handleReset = async () => {
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess("Password updated successfully!");
      setTimeout(() => navigate("/"), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f1", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: "#fff", border: "0.5px solid #e2e0d8", borderRadius: 16, padding: "36px 40px", width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#185fa5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#2c2c2a" }}>StatViz</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", marginBottom: 4 }}>Set new password</div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>Enter your new password below</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>New password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters"
            style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "0.5px solid #d3d1c7", borderRadius: 8, background: "#fafaf8", color: "#2c2c2a", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password"
            onKeyDown={e => e.key === "Enter" && handleReset()}
            style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "0.5px solid #d3d1c7", borderRadius: 8, background: "#fafaf8", color: "#2c2c2a", outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <div style={{ background: "#fcebeb", border: "0.5px solid #f7c1c1", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#a32d2d", fontSize: 12 }}>⚠ {error}</div>}
        {success && <div style={{ background: "#eaf3de", border: "0.5px solid #c0dd97", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#3b6d11", fontSize: 12 }}>✓ {success}</div>}
        <button onClick={handleReset} disabled={loading}
          style={{ width: "100%", padding: "11px", fontSize: 14, fontWeight: 500, background: loading ? "#b5d4f4" : "#185fa5", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Updating..." : "Update Password →"}
        </button>
      </div>
    </div>
  );
}