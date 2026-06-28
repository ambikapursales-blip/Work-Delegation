import * as React from "react";

const buttonVariants = {
  base: "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  variants: {
    variant: {
      default: "bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] font-semibold hover:shadow-neon hover:scale-[1.02] active:scale-95",
      secondary: "bg-white/[0.08] text-white hover:bg-white/[0.12] border border-white/[0.06]",
      destructive: "bg-gradient-to-r from-[#FF6B6B] to-[#FF4444] text-white font-semibold hover:shadow-lg",
      outline: "border border-white/[0.12] bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.2]",
      ghost: "hover:bg-white/[0.06] text-white/70 hover:text-white",
      link: "text-[#00FF88] underline-offset-4 hover:underline",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3 text-xs",
      lg: "h-11 px-8",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
};

function getButtonClass(variant = "default", size = "default") {
  let classes = buttonVariants.base;
  classes += " " + buttonVariants.variants.variant[variant];
  classes += " " + buttonVariants.variants.size[size];
  return classes;
}

const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={
        getButtonClass(variant, size) + (className ? " " + className : "")
      }
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
