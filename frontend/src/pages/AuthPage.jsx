import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup | otp | forgot | reset_sent
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = () => { setError(null); setSuccess(null); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) onAuth(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Signup → sends OTP ─────────────────────────────────────────────────────
  const handleSignup = async () => {
    clearMessages();
    if (!name) { setError("Please enter your name."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      setSuccess("OTP sent to your email! Please check your inbox.");
      setMode("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      setSuccess("Email verified! Logging you in...");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) onAuth(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      setSuccess("OTP resent! Please check your inbox.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    clearMessages();
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMode("reset_sent");
      setSuccess(`Password reset link sent to ${email}. Please check your inbox.`);
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

        {/* ── OTP Verification ── */}
        {mode === "otp" && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", marginBottom: 4 }}>Verify your email</div>
            <div style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>
              We sent a 6-digit OTP to <strong>{email}</strong>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 20,
                  border: "0.5px solid #d3d1c7", borderRadius: 8,
                  background: "#fafaf8", color: "#2c2c2a",
                  outline: "none", boxSizing: "border-box",
                  letterSpacing: "0.3em", textAlign: "center", fontWeight: 600,
                }}
              />
            </div>

            {error && <div style={{ background: "#fcebeb", border: "0.5px solid #f7c1c1", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#a32d2d", fontSize: 12 }}>⚠ {error}</div>}
            {success && <div style={{ background: "#eaf3de", border: "0.5px solid #c0dd97", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#3b6d11", fontSize: 12 }}>✓ {success}</div>}

            <button onClick={handleVerifyOtp} disabled={loading} style={{ width: "100%", padding: "11px", fontSize: 14, fontWeight: 500, background: loading ? "#b5d4f4" : "#185fa5", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", marginBottom: 12 }}>
              {loading ? "Verifying..." : "Verify OTP →"}
            </button>

            <div style={{ textAlign: "center", fontSize: 12, color: "#888780" }}>
              Didn't receive it?{" "}
              <span onClick={handleResendOtp} style={{ color: "#185fa5", fontWeight: 500, cursor: "pointer" }}>Resend OTP</span>
              {" · "}
              <span onClick={() => { setMode("signup"); clearMessages(); }} style={{ color: "#185fa5", fontWeight: 500, cursor: "pointer" }}>Go back</span>
            </div>
          </div>
        )}

        {/* ── Forgot Password ── */}
        {mode === "forgot" && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", marginBottom: 4 }}>Reset password</div>
            <div style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>Enter your email and we'll send you a reset link</div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Email address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "0.5px solid #d3d1c7", borderRadius: 8, background: "#fafaf8", color: "#2c2c2a", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && <div style={{ background: "#fcebeb", border: "0.5px solid #f7c1c1", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#a32d2d", fontSize: 12 }}>⚠ {error}</div>}
            {success && <div style={{ background: "#eaf3de", border: "0.5px solid #c0dd97", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#3b6d11", fontSize: 12 }}>✓ {success}</div>}

            <button onClick={handleForgotPassword} disabled={loading} style={{ width: "100%", padding: "11px", fontSize: 14, fontWeight: 500, background: loading ? "#b5d4f4" : "#185fa5", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", marginBottom: 12 }}>
              {loading ? "Sending..." : "Send Reset Link →"}
            </button>
            <div style={{ textAlign: "center", fontSize: 12, color: "#888780" }}>
              <span onClick={() => { setMode("login"); clearMessages(); }} style={{ color: "#185fa5", fontWeight: 500, cursor: "pointer" }}>← Back to login</span>
            </div>
          </div>
        )}

        {/* ── Reset Sent ── */}
        {mode === "reset_sent" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#2c2c2a", marginBottom: 8 }}>Check your inbox</div>
            <div style={{ fontSize: 13, color: "#888780", marginBottom: 24, lineHeight: 1.6 }}>
              We sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
            </div>
            <button onClick={() => { setMode("login"); clearMessages(); }} style={{ width: "100%", padding: "11px", fontSize: 14, fontWeight: 500, background: "#185fa5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              ← Back to login
            </button>
          </div>
        )}

        {/* ── Login / Signup ── */}
        {(mode === "login" || mode === "signup") && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#2c2c2a", letterSpacing: "-0.02em", marginBottom: 4 }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </div>
            <div style={{ fontSize: 13, color: "#888780", marginBottom: 24 }}>
              {mode === "login" ? "Sign in to your StatViz account" : "Start analysing your data today"}
            </div>

            {mode === "signup" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Full name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "0.5px solid #d3d1c7", borderRadius: 8, background: "#fafaf8", color: "#2c2c2a", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "0.5px solid #d3d1c7", borderRadius: 8, background: "#fafaf8", color: "#2c2c2a", outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: mode === "login" ? 8 : 20 }}>
              <label style={{ fontSize: 12, color: "#5f5e5a", fontWeight: 500, display: "block", marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters"
                onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignup())}
                style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "0.5px solid #d3d1c7", borderRadius: 8, background: "#fafaf8", color: "#2c2c2a", outline: "none", boxSizing: "border-box" }} />
            </div>

            {mode === "login" && (
              <div style={{ textAlign: "right", marginBottom: 16 }}>
                <span onClick={() => { setMode("forgot"); clearMessages(); }} style={{ fontSize: 12, color: "#185fa5", fontWeight: 500, cursor: "pointer" }}>
                  Forgot password?
                </span>
              </div>
            )}

            {error && <div style={{ background: "#fcebeb", border: "0.5px solid #f7c1c1", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#a32d2d", fontSize: 12 }}>⚠ {error}</div>}
            {success && <div style={{ background: "#eaf3de", border: "0.5px solid #c0dd97", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#3b6d11", fontSize: 12 }}>✓ {success}</div>}

            <button
              onClick={mode === "login" ? handleLogin : handleSignup}
              disabled={loading}
              style={{ width: "100%", padding: "11px", fontSize: 14, fontWeight: 500, background: loading ? "#b5d4f4" : "#185fa5", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em", transition: "background 0.15s" }}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in →" : "Create account →"}
            </button>

            <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#888780" }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); clearMessages(); }} style={{ color: "#185fa5", fontWeight: 500, cursor: "pointer" }}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}