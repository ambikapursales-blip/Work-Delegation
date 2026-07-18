"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export default function Toast({ type = "success", message, onClose, duration = 3000 }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const isSuccess = type === "success";
  const themeVar = isSuccess ? "var(--color-success)" : "var(--color-danger)";
  const bgClass = "backdrop-blur-xl border shadow-glass-sm";
  const icon = isSuccess
    ? <CheckCircle2 className="w-5 h-5" style={{ color: themeVar }} />
    : <AlertCircle className="w-5 h-5" style={{ color: themeVar }} />;

  return (
    <div
      className={`fixed top-4 right-4 left-4 sm:left-auto z-50 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[-20px]"
      }`}
    >
      <div className={`${bgClass} rounded-xl px-4 py-3 flex items-center gap-3 min-w-0 sm:min-w-[300px]`} style={{ borderColor: `color-mix(in srgb, ${themeVar} 30%, transparent)`, backgroundColor: "var(--bg-card)" }}>
        {icon}
        <p className="text-sm font-medium flex-1" style={{ color: themeVar }}>{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          style={{ color: "var(--text-muted)" }}
          className="transition-opacity hover:opacity-70"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
