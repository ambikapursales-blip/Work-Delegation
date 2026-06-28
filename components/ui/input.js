import * as React from "react";

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={
      "flex h-10 w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/40 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF88]/30 focus-visible:border-[#00FF88]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 " +
      (className || "")
    }
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
