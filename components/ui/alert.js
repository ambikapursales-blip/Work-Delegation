import React from "react";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

function Alert({ className, ...props }) {
  return (
    <div
      className={
        "relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 " +
        (className || "")
      }
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-muted)",
      }}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }) {
  return (
    <h5
      className={
        "mb-1 font-medium leading-tight [&_p]:inline " + (className || "")
      }
      style={{ color: "var(--text-primary)" }}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }) {
  return (
    <div
      className={"text-sm [&_p]:leading-relaxed " + (className || "")}
      style={{ color: "var(--text-secondary)" }}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
