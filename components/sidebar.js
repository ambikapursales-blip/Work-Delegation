"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Calendar,
  Users,
  Bell,
  LogOut,
  Activity,
  BarChart3,
  Sparkles,
} from "lucide-react";

const getAllMenuItems = () => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    href: "/tasks",
  },
  {
    title: "DWR",
    icon: FileText,
    href: "/dwr",
  },
  {
    title: "Events",
    icon: Calendar,
    href: "/events",
  },
  {
    title: "Attendance",
    icon: Activity,
    href: "/attendance",
  },
  {
    title: "Users",
    icon: Users,
    href: "/users",
  },
  {
    title: "Performance",
    icon: BarChart3,
    href: "/performance",
  },
];

const ROLE_MENU = {
  Admin: ["Dashboard", "Tasks", "Events", "Users", "Performance"],
  Manager: ["Dashboard", "Tasks", "Events", "Users", "Performance"],
  HR: ["Dashboard", "Tasks", "DWR", "Attendance", "Performance"],
  "Sales Executive": ["Dashboard", "Tasks", "Events", "Performance"],
  Coordinator: ["Dashboard", "Tasks", "Events", "Performance"],
  It: ["Dashboard", "Tasks", "Events", "Performance"],
};

export default function Sidebar({ isOpen, setIsOpen }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const allItems = getAllMenuItems();
  const allowedTitles = ROLE_MENU[user?.role] || [];
  const menuItems = allItems.filter((item) =>
    allowedTitles.includes(item.title),
  );

  const pathname = usePathname();

  return (
    <>
      <aside
        className={`fixed md:relative z-30 h-full w-64 transition-transform duration-300 bg-[#0A0F1A] border-r border-white/[0.06] ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full p-4 pt-16 md:pt-4">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#00FF88] to-[#00CC70] shadow-lg shadow-[#00FF88]/20">
              <span className="font-bold text-[#0B1220] text-lg">D</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Delegation</h1>
              <p className="text-xs text-white/40">{user?.role || "User"}</p>
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-widest mb-3 ml-2 font-semibold text-white/30">
            Navigation
          </p>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setIsOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                      isActive
                        ? "bg-white/[0.08] text-[#00FF88] shadow-[inset_3px_0_0_#00FF88]"
                        : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-[#00FF88]" : ""}`} />
                    {item.title}
                  </button>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.06] pt-4 mt-4">
            <a
              href="https://deepsikha-ai.vercel.app/ai-assistant"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white transition-all duration-200 font-medium border border-white/[0.06]">
                <Sparkles className="h-5 w-5 text-[#B366FF]" />
                AI Assistant
              </button>
            </a>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FF6B6B]/10 text-[#FF6B6B] hover:bg-[#FF6B6B]/20 transition-all duration-200 font-medium"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
