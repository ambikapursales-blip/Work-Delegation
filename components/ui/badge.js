import * as React from "react";

function Badge({ className, ...props }) {
  return (
    <div
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 " +
        (className || "")
      }
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-muted)",
        color: "var(--text-secondary)",
      }}
      {...props}
    />
  );
}

export { Badge };
