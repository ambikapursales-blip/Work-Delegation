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
    <div className="flex items-center justify-center min-h-screen bg-[#0B1220]">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4 text-white/85">Delegation & DWR System</h1>
        <p className="text-white/50">Loading...</p>
      </div>
    </div>
  );
}
