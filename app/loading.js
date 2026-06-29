import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1220]">
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold text-white/85">
          Delegation & DWR System
        </h1>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#00FF88]" />
      </div>
    </div>
  );
}
