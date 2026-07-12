"use client";

import { DashboardSkeleton } from "@/components/skeleton";

export function LoadingSpinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`rounded-full animate-shimmer ${sizes[size]}`}
        style={{
          background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

export function Loading() {
  return <DashboardSkeleton />;
}
