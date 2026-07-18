"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { DashboardSkeleton } from "@/components/skeleton";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && typeof window !== "undefined") {
      const currentPath =
        window.location.pathname.split("/").filter(Boolean)[0] || "dashboard";

      if (!["dashboard", "tasks", "dwr", "events", "attendance", "users", "performance", "profile", "team"].includes(currentPath)) {
        router.push("/dashboard");
      }
    }
  }, [user, router]);

  if (loading) return <DashboardSkeleton />;
  if (!user)   return <DashboardSkeleton />;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: "var(--bg-base)" }}
        >
          <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}