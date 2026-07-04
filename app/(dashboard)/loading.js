import { LoadingSpinner } from "@/components/loading";

export default function DashboardLoading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
