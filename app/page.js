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
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Delegation & DWR System</h1>
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    </div>
  );
}
