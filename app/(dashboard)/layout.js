"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { Loading } from "@/components/loading";

const ROLE_ROUTES = {
  Admin: [
    "dashboard",
    "tasks",
    "dwr",
    "events",
    "users",
    "performance",
    "profile",
  ],
  Manager: [
    "dashboard",
    "tasks",
    "dwr",
    "events",
    "users",
    "performance",
    "profile",
  ],
  HR: ["dashboard", "tasks", "dwr", "attendance", "performance", "profile"],
  "Sales Executive": [
    "dashboard",
    "tasks",
    "dwr",
    "events",
    "performance",
    "profile",
  ],
  Coordinator: [
    "dashboard",
    "tasks",
    "dwr",
    "events",
    "performance",
    "profile",
  ],
};

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
      const allowedRoutes = ROLE_ROUTES[user.role] || [];

      if (!allowedRoutes.includes(currentPath)) {
        router.push("/dashboard");
      }
    }
  }, [user, router]);

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Loading />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B1220]">
      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
