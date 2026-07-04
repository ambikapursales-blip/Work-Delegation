// import * as React from "react";

// const buttonVariants = {
//   base: "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
//   variants: {
//     variant: {
//       default: "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-mid)] text-[#0B1220] font-semibold hover:shadow-neon hover:scale-[1.02] active:scale-95",
//       secondary: "bg-white/[0.08] text-white hover:bg-white/[0.12] border border-white/[0.06]",
//       destructive: "bg-gradient-to-r from-[#FF6B6B] to-[#FF4444] text-white font-semibold hover:shadow-lg",
//       outline: "border border-white/[0.12] bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.2]",
//       ghost: "hover:bg-white/[0.06] text-white/70 hover:text-white",
//       link: "text-[var(--primary)] underline-offset-4 hover:underline",
//     },
//     size: {
//       default: "h-10 px-4 py-2",
//       sm: "h-9 px-3 text-xs",
//       lg: "h-11 px-8",
//       icon: "h-10 w-10",
//     },
//   },
//   defaultVariants: {
//     variant: "default",
//     size: "default",
//   },
// };

// function getButtonClass(variant = "default", size = "default") {
//   let classes = buttonVariants.base;
//   classes += " " + buttonVariants.variants.variant[variant];
//   classes += " " + buttonVariants.variants.size[size];
//   return classes;
// }

// const Button = React.forwardRef(
//   ({ className, variant, size, ...props }, ref) => (
//     <button
//       className={
//         getButtonClass(variant, size) + (className ? " " + className : "")
//       }
//       ref={ref}
//       {...props}
//     />
//   ),
// );
// Button.displayName = "Button";

// export { Button, buttonVariants };
import * as React from "react";
import { LoadingSpinner } from "@/components/loading";

/*
  Variant styles expressed as inline style objects so they
  automatically pick up whichever theme is active via CSS vars.
*/
const VARIANT_STYLES = {
  default: {
    background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
    color: "var(--text-inverse)",
    border: "none",
    boxShadow: "0 2px 8px var(--accent-glow)",
    fontWeight: 600,
  },
  secondary: {
    background: "var(--bg-muted)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    fontWeight: 500,
  },
  destructive: {
    background: "linear-gradient(135deg, var(--color-danger) 0%, var(--color-danger) 100%)",
    color: "white",
    border: "none",
    fontWeight: 600,
  },
  outline: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    fontWeight: 500,
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
    fontWeight: 500,
  },
  link: {
    background: "transparent",
    color: "var(--accent)",
    border: "none",
    textDecoration: "underline",
    textUnderlineOffset: "4px",
    fontWeight: 500,
  },
};

const VARIANT_HOVER_STYLES = {
  default: { boxShadow: "0 4px 20px var(--accent-glow), 0 0 0 1px var(--accent)", transform: "translateY(-1px)" },
  secondary: { background: "var(--bg-card-hover)", color: "var(--text-primary)", borderColor: "var(--border-hover)" },
  destructive: { opacity: 0.9, transform: "translateY(-1px)" },
  outline: { background: "var(--bg-muted)", color: "var(--text-primary)", borderColor: "var(--border-hover)" },
  ghost: { background: "var(--bg-muted)", color: "var(--text-primary)" },
  link: {},
};

const VARIANT_ACTIVE_STYLES = {
  default: { transform: "scale(0.97)" },
  secondary: { transform: "scale(0.97)" },
  destructive: { transform: "scale(0.97)" },
  outline: { transform: "scale(0.97)" },
  ghost: { transform: "scale(0.97)" },
  link: {},
};

const SIZE_CLASSES = {
  default: "h-10 px-4 py-2 text-sm",
  sm:      "h-8 px-3 py-1.5 text-xs",
  lg:      "h-11 px-8 py-2.5 text-sm",
  icon:    "h-10 w-10 p-0",
};

const Button = React.forwardRef(
  ({ 
    className, 
    variant = "default", 
    size = "default", 
    style, 
    loading = false,
    loadingText = "Loading...",
    children,
    disabled,
    ...props 
  }, ref) => {
    const [hovered, setHovered] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);

    const baseStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
    const hoverStyle = hovered && !loading ? (VARIANT_HOVER_STYLES[variant] || {}) : {};
    const activeStyle = pressed && !loading ? (VARIANT_ACTIVE_STYLES[variant] || {}) : {};
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-xl",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          SIZE_CLASSES[size] || SIZE_CLASSES.default,
          className || "",
        ].join(" ")}
        style={{
          ...baseStyle,
          ...hoverStyle,
          ...activeStyle,
          ...style,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" />
            <span>{loadingText}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };