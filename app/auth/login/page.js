"use client";

import { useState, useCallback, useMemo } from "react";
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
  
  // Memoize form data to prevent unnecessary re-renders
  const formData = useMemo(() => ({
    email,
    password,
    loading,
    error,
    showPassword
  }), [email, password, loading, error, showPassword]);

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
    <div className="min-h-screen flex bg-[#0B1220] overflow-hidden">

      {/* ── Left decorative panel (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 py-12 relative overflow-hidden bg-gradient-to-br from-[#0B1220] via-[#0F1A2A] to-[#16202C]">
        {/* Blobs */}
        <div className="absolute w-96 h-96 rounded-full bg-white opacity-10 -top-24 -left-24" />
        <div className="absolute w-64 h-64 rounded-full bg-white opacity-10 bottom-16 -right-20" />
        <div className="absolute w-36 h-36 rounded-full bg-white opacity-10 top-[45%] left-[55%]" />

        {/* Brand */}
        <div className="relative z-10 text-center">
          <div
            className="mx-auto mb-7 flex items-center justify-center rounded-2xl border-2 border-white/30 backdrop-blur-sm"
            style={{ width: 72, height: 72, background: "rgba(255,255,255,0.15)" }}
          >
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="font-bold text-4xl text-white tracking-tight leading-tight mb-3">
            Delegation
          </h1>
          <p className="text-sm font-light text-white/70 max-w-[280px] leading-relaxed mx-auto">
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
              className="flex items-center gap-3 border border-white/15 rounded-xl px-4 py-3 backdrop-blur-sm"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="w-2 h-2 rounded-full bg-[#00FF88] flex-shrink-0" />
              <span className="text-sm text-white/80">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 bg-[#0A0F1A]">
        <div className="w-full max-w-md">

          {/* Mobile-only logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-9">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00FF88] to-[#00CC70] flex items-center justify-center">
              <LogIn className="text-white" size={20} />
            </div>
            <span className="font-bold text-xl text-white/85 tracking-tight">
              Delegation
            </span>
          </div>

          <h2 className="font-bold text-3xl text-white/85 tracking-tight mb-1.5">
            Welcome back
          </h2>
          <p className="text-sm text-white/50 mb-8">
            Sign in to your account to continue
          </p>

          {/* Error alert */}
          {error && (
            <div className="flex items-start gap-2.5 bg-white/[0.04] backdrop-blur-xl border border-red-500/30 rounded-xl px-3.5 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-[#FF6B6B] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-400 leading-snug">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div className="mb-5">
              <label
                htmlFor="email"
                className="flex items-center gap-1.5 text-sm font-medium text-white/70 mb-2"
              >
                <Mail size={14} className="text-[#00FF88]" />
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
                className="w-full h-11 px-3.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-150 focus:border-[#00FF88] focus:bg-white/[0.08] focus:ring-4 focus:ring-[#00FF88]/10 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <label
                htmlFor="password"
                className="flex items-center gap-1.5 text-sm font-medium text-white/70 mb-2"
              >
                <Lock size={14} className="text-[#00FF88]" />
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
                  className="w-full h-11 px-3.5 pr-11 bg-white/[0.05] border border-white/[0.1] rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-150 focus:border-[#00FF88] focus:bg-white/[0.08] focus:ring-4 focus:ring-[#00FF88]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors duration-150 flex items-center bg-transparent border-none cursor-pointer p-0"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-7 flex items-center justify-center gap-2 bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] text-sm font-semibold rounded-xl tracking-wide shadow-[0_4px_14px_rgba(0,255,136,0.25)] transition-all duration-150 hover:opacity-90 hover:shadow-[0_6px_20px_rgba(0,255,136,0.35)] hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none cursor-pointer border-none"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
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
          <div className="mt-7 pt-5 border-t border-white/[0.06] text-center">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2.5">
              Demo Credentials
            </p>
            <div className="inline-block bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 font-mono text-xs text-white/60 leading-relaxed">
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