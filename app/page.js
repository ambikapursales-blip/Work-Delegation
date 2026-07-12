"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/auth/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="text-center space-y-4">
        <div
          className="animate-shimmer mx-auto rounded-full"
          style={{
            width: 48,
            height: 48,
            background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",
            backgroundSize: "200% 100%",
          }}
        />
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Delegation & DWR System</h1>
        <div
          className="animate-shimmer mx-auto rounded-lg"
          style={{
            width: 120,
            height: 12,
            background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
    </div>
  );
}
