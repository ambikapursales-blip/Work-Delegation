import { LoadingSpinner } from "@/components/loading";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Delegation & DWR System
        </h1>
        <LoadingSpinner size="xl" />
      </div>
    </div>
  );
}
