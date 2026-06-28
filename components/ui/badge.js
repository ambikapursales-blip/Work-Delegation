import * as React from "react";

function Badge({ className, ...props }) {
  return (
    <div
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-white/[0.08] bg-white/[0.06] text-white/80 hover:bg-white/[0.1] " +
        (className || "")
      }
      {...props}
    />
  );
}

export { Badge };
