// import * as React from "react";

// const Card = React.forwardRef(({ className, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={
//       "rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] text-card-foreground shadow-glass-sm " +
//       (className || "")
//     }
//     {...props}
//   />
// ));
// Card.displayName = "Card";

// const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={"flex flex-col space-y-1.5 p-6 " + (className || "")}
//     {...props}
//   />
// ));
// CardHeader.displayName = "CardHeader";

// const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={"flex items-center p-6 pt-0 " + (className || "")}
//     {...props}
//   />
// ));
// CardFooter.displayName = "CardFooter";

// const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
//   <h2
//     ref={ref}
//     className={
//       "text-xl font-semibold leading-none tracking-tight text-white " + (className || "")
//     }
//     {...props}
//   />
// ));
// CardTitle.displayName = "CardTitle";

// const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
//   <p
//     ref={ref}
//     className={"text-sm text-white/50 " + (className || "")}
//     {...props}
//   />
// ));
// CardDescription.displayName = "CardDescription";

// const CardContent = React.forwardRef(({ className, ...props }, ref) => (
//   <div ref={ref} className={"p-6 pt-0 " + (className || "")} {...props} />
// ));
// CardContent.displayName = "CardContent";

// export {
//   Card,
//   CardHeader,
//   CardFooter,
//   CardTitle,
//   CardDescription,
//   CardContent,
// };
import * as React from "react";

const Card = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={"rounded-2xl transition-all duration-300 " + (className || "")}
    style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      color: "var(--text-primary)",
      boxShadow: "var(--shadow-card)",
      ...style,
    }}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={"flex flex-col space-y-1.5 p-6 " + (className || "")}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={"flex items-center p-6 pt-0 " + (className || "")}
    style={{ borderTop: "1px solid var(--border)" }}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

const CardTitle = React.forwardRef(({ className, style, ...props }, ref) => (
  <h2
    ref={ref}
    className={"text-xl font-semibold leading-none tracking-tight " + (className || "")}
    style={{ color: "var(--text-primary)", ...style }}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, style, ...props }, ref) => (
  <p
    ref={ref}
    className={"text-sm " + (className || "")}
    style={{ color: "var(--text-secondary)", ...style }}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={"p-6 pt-0 " + (className || "")} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };