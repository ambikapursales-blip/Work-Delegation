import React from "react";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

function Alert({ className, ...props }) {
  return (
    <div
      className={
        "relative w-full rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-white/70 " +
        (className || "")
      }
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }) {
  return (
    <h5
      className={
        "mb-1 font-medium leading-tight text-white [&_p]:inline " + (className || "")
      }
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }) {
  return (
    <div
      className={"text-sm text-white/60 [&_p]:leading-relaxed " + (className || "")}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
