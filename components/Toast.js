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

  const bgClass = "bg-white/[0.04] backdrop-blur-xl border shadow-glass-sm";
  const borderColor = type === "success" ? "border-[#00FF88]/30" : "border-[#FF6B6B]/30";
  const textColor = type === "success" ? "text-[#00FF88]" : "text-[#FF6B6B]";
  const icon = type === "success" ? <CheckCircle2 className="w-5 h-5 text-[#00FF88]" /> : <AlertCircle className="w-5 h-5 text-[#FF6B6B]" />;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[-20px]"
      }`}
    >
      <div className={`${bgClass} ${borderColor} rounded-xl px-4 py-3 flex items-center gap-3 min-w-[300px]`}>
        {icon}
        <p className={`text-sm font-medium flex-1 ${textColor}`}>{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-white/50 hover:text-white/70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
