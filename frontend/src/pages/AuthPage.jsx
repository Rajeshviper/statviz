import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setSuccess("Account created! You are now logged in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      // Get session and notify parent
      const { data: { user } } = await supabase.auth.getUser();
      if (user) onAuth(user);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f7f6f1",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{
        background: "#fff", border: "0.5px solid #e2e0d8",
        borderRadius: 16, padding: "36px 40px", width: "100%", maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "#185fa5",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 16,
          }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em" }}>StatViz</span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em", marginBottom: 4 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>
          {mode === "login" ? "Sign in to your StatViz account" : "Start analysing your data today"}
        </div>

        {/* Name field (signup only) */}
        {mode === "signup" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%", padding: "10px 14px", fontSize: 13,
                border: "0.5px solid #d3d1c7", borderRadius: 8,
                background: "#fafaf8", color: "#2c2c2a",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Email field */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%", padding: "10px 14px", fontSize: 13,
              border: "0.5px solid #d3d1c7", borderRadius: 8,
              background: "#fafaf8", color: "#2c2c2a",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Password field */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{
              width: "100%", padding: "10px 14px", fontSize: 13,
              border: "0.5px solid #d3d1c7", borderRadius: 8,
              background: "#fafaf8", color: "#2c2c2a",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#fcebeb", border: "0.5px solid #f7c1c1",
            borderRadius: 8, padding: "10px 14px", marginBottom: 14,
            color: "#a32d2d", fontSize: 12,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{
            background: "#eaf3de", border: "0.5px solid #c0dd97",
            borderRadius: 8, padding: "10px 14px", marginBottom: 14,
            color: "#3b6d11", fontSize: 12,
          }}>
            ✓ {success}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "11px", fontSize: 14, fontWeight: 500,
            background: loading ? "#b5d4f4" : "#185fa5", color: "#fff",
            border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em", transition: "background 0.15s",
          }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        {/* Toggle mode */}
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#888780" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setSuccess(null); }}
            style={{ color: "#185fa5", fontWeight: 500, cursor: "pointer" }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </div>
      </div>
    </div>
  );
}