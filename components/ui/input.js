// import * as React from "react";

// const Input = React.forwardRef(({ className, type, ...props }, ref) => (
//   <input
//     type={type}
//     className={
//       "flex h-10 w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/40 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF88]/30 focus-visible:border-[#00FF88]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 " +
//       (className || "")
//     }
//     ref={ref}
//     {...props}
//   />
// ));
// Input.displayName = "Input";

// export { Input };
import * as React from "react";

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  const [focused, setFocused] = React.useState(false);

  return (
    <input
      type={type}
      ref={ref}
      className={[
        "flex h-10 w-full rounded-xl px-3 py-2 text-sm",
        "transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none",
        className || "",
      ].join(" ")}
      style={{
        background: "var(--bg-input)",
        border: `1px solid ${focused ? "var(--border-focus)" : "var(--border)"}`,
        color: "var(--text-primary)",
        boxShadow: focused ? "var(--shadow-input-focus)" : "none",
        /* placeholder handled via CSS below */
        ...style,
      }}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };