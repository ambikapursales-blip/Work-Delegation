import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#00FF88]" />
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
