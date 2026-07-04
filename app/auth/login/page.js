"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authAPI } from "@/lib/api";
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const response = await Promise.race([
        authAPI.login(email, password),
        timeoutPromise
      ]);
      
      const { token, user } = response.data;

      // Optimized login - immediate redirect
      login(user, token);
      
      // Use replace instead of push for faster navigation
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, login, router]);

  return (
    <div className="min-h-screen flex overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}>

      {/* ── Left decorative panel (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 py-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-surface) 50%, var(--bg-card) 100%)",
        }}>
        {/* Blobs */}
        <div className="absolute w-96 h-96 rounded-full pointer-events-none -top-24 -left-24"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />
        <div className="absolute w-64 h-64 rounded-full pointer-events-none bottom-16 -right-20"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />
        <div className="absolute w-36 h-36 rounded-full pointer-events-none top-[45%] left-[55%]"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />

        {/* Brand */}
        <div className="relative z-10 text-center">
          <div
            className="mx-auto mb-7 flex items-center justify-center rounded-2xl border-2 backdrop-blur-sm"
            style={{
              width: 72, height: 72,
              borderColor: "color-mix(in srgb, var(--text-primary) 30%, transparent)",
              background: "color-mix(in srgb, var(--text-primary) 12%, transparent)",
            }}
          >
            <LogIn size={32} style={{ color: "var(--text-primary)" }} />
          </div>
          <h1 className="font-bold text-4xl tracking-tight leading-tight mb-3"
            style={{ color: "var(--text-primary)" }}>
            Delegation
          </h1>
          <p className="text-sm font-light max-w-[280px] leading-relaxed mx-auto"
            style={{ color: "var(--text-secondary)" }}>
            Streamline your workflow with intelligent task delegation and team management.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 mt-12 flex flex-col gap-3 w-full max-w-xs">
          {[
            "Assign tasks with precision and clarity",
            "Real-time progress visibility",
            "Automated accountability tracking",
          ].map((text) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-xl px-4 py-3 backdrop-blur-sm"
              style={{
                border: "1px solid color-mix(in srgb, var(--text-primary) 15%, transparent)",
                background: "color-mix(in srgb, var(--text-primary) 6%, transparent)",
              }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: "var(--color-success)" }} />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8"
        style={{ backgroundColor: "var(--bg-surface)" }}>
        <div className="w-full max-w-md">

          {/* Mobile-only logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-9">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              }}>
              <LogIn size={20} style={{ color: "var(--text-inverse)" }} />
            </div>
            <span className="font-bold text-xl tracking-tight"
              style={{ color: "var(--text-primary)" }}>
              Delegation
            </span>
          </div>

          <h2 className="font-bold text-3xl tracking-tight mb-1.5"
            style={{ color: "var(--text-primary)" }}>
            Welcome back
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
            Sign in to your account to continue
          </p>

          {/* Error alert */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-5"
              style={{
                backgroundColor: "var(--bg-muted)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-danger)" }} />
              <span className="text-sm leading-snug"
                style={{ color: "var(--color-danger)" }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div className="mb-5">
              <label
                htmlFor="email"
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <Mail size={14} style={{ color: "var(--accent)" }} />
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="input-field h-11 text-sm"
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <label
                htmlFor="password"
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <Lock size={14} style={{ color: "var(--accent)" }} />
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="input-field h-11 text-sm pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 flex items-center bg-transparent border-none cursor-pointer p-0"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right mb-5 mt-4">
              <Link
                href="/forgot-password"
                className="text-xs transition-colors duration-150 no-underline hover:underline"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl tracking-wide transition-all duration-150 cursor-pointer border-none"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                color: "var(--text-inverse)",
                boxShadow: "0 4px 14px var(--accent-glow)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
                e.currentTarget.style.boxShadow = "0 6px 20px var(--accent-glow), 0 0 0 1px var(--accent)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.boxShadow = "0 4px 14px var(--accent-glow)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{
                      borderColor: "var(--text-inverse)",
                      borderTopColor: "transparent",
                      animationDuration: "1.5s",
                    }} />
                  Signing in\u2026
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-7 pt-5 text-center"
            style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2.5"
              style={{ color: "var(--text-muted)" }}>
              Demo Credentials
            </p>
            <div className="inline-block rounded-lg px-4 py-2.5 font-mono text-xs leading-relaxed"
              style={{
                backgroundColor: "var(--bg-muted)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}>
              test@example.com
              <br />
              password123
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
