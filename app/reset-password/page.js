"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authAPI } from "@/lib/api";
import {
  Key,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  CheckCircle2,
} from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
  }, [email, router]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!otp.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 10000)
      );

      await Promise.race([
        authAPI.resetPassword(email, otp, newPassword),
        timeoutPromise,
      ]);

      setSuccess("Password has been reset successfully! Redirecting to login...");
      setTimeout(() => router.replace("/auth/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, otp, newPassword, confirmPassword, router]);

  return (
    <div className="min-h-screen flex overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}>

      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 py-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-surface) 50%, var(--bg-card) 100%)",
        }}>
        <div className="absolute w-96 h-96 rounded-full pointer-events-none -top-24 -left-24"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />
        <div className="absolute w-64 h-64 rounded-full pointer-events-none bottom-16 -right-20"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />
        <div className="absolute w-36 h-36 rounded-full pointer-events-none top-[45%] left-[55%]"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />

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
                background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
              }}>
              <LogIn size={20} style={{ color: "var(--text-inverse)" }} />
            </div>
            <span className="font-bold text-xl tracking-tight"
              style={{ color: "var(--text-primary)" }}>
              Delegation
            </span>
          </div>

          {/* Back to forgot password */}
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs transition-colors duration-150 no-underline mb-8"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-success)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <Key size={14} />
            Request new OTP
          </Link>

          <h2 className="font-bold text-3xl tracking-tight mb-1.5"
            style={{ color: "var(--text-primary)" }}>
            Reset Password
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
            Enter the OTP sent to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
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

          {/* Success alert */}
          {success && (
            <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-5"
              style={{
                backgroundColor: "var(--bg-muted)",
                border: "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
              }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-success)" }} />
              <span className="text-sm leading-snug"
                style={{ color: "var(--color-success)" }}>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* OTP */}
            <div className="mb-5">
              <label
                htmlFor="otp"
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <Key size={14} style={{ color: "var(--color-success)" }} />
                One-Time Password (OTP)
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                disabled={loading}
                className="input-field h-11 text-sm text-center tracking-[8px] font-mono"
              />
            </div>

            {/* New Password */}
            <div className="mb-5">
              <label
                htmlFor="newPassword"
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <Lock size={14} style={{ color: "var(--color-success)" }} />
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

            {/* Confirm Password */}
            <div className="mb-5">
              <label
                htmlFor="confirmPassword"
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <Lock size={14} style={{ color: "var(--color-success)" }} />
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="input-field h-11 text-sm pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  disabled={loading}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 flex items-center bg-transparent border-none cursor-pointer p-0"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl tracking-wide transition-all duration-150 cursor-pointer border-none"
              style={{
                background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                color: "var(--text-inverse)",
                boxShadow: "0 4px 14px color-mix(in srgb, var(--color-success) 25%, transparent)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
                e.currentTarget.style.boxShadow = "0 6px 20px color-mix(in srgb, var(--color-success) 35%, transparent)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.boxShadow = "0 4px 14px color-mix(in srgb, var(--color-success) 25%, transparent)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: "color-mix(in srgb, var(--text-inverse) 30%, transparent)",
                      borderTopColor: "var(--text-inverse)",
                    }} />
                  Resetting\u2026
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Reset Password
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
