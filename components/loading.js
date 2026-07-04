import React from "react";

export function LoadingSpinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2",
    xl: "w-12 h-12 border-3",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`rounded-full border-t-transparent animate-spin ${sizes[size]}`}
        style={{
          borderColor: "var(--accent)",
          borderTopColor: "transparent",
          animationDuration: "1.5s",
        }}
      />
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
