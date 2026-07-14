"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Calendar,
  Users,
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
  "Super Admin": ["Dashboard", "Tasks", "DWR", "Events", "Attendance", "Users", "Performance"],
  Admin: ["Dashboard", "Tasks", "DWR", "Events"],
  Manager: ["Dashboard", "Tasks", "DWR", "Events"],
  HR: ["Dashboard", "Tasks", "DWR", "Attendance"],
  "Sales Executive": ["Dashboard", "Tasks", "DWR", "Events"],
  Coordinator: ["Dashboard", "Tasks", "DWR", "Events"],
  It: ["Dashboard", "Tasks", "DWR", "Events"],
};

export default function Sidebar({ isOpen, setIsOpen }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [logoutHovered, setLogoutHovered] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, setIsOpen]);

  return (
    <>
      <aside
        className={`
          fixed lg:relative z-30 h-full w-72 overflow-y-auto
          transition-transform duration-300 ease-in-out
          bg-[var(--bg-base)]
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
        style={{ borderRight: "1px solid var(--border)", boxShadow: "var(--sidebar-shadow)" }}
      >
        <div className="flex flex-col h-full p-5 pt-16 md:pt-5">
          <div className="mb-10 flex items-center gap-3 px-1">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] shadow-lg shadow-[#2563EB]/30 bg-logo">
              <span className="font-bold text-white text-lg">D</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Delegation</h1>
              <p className="text-xs text-[var(--text-secondary)]">{user?.role || "User"}</p>
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-widest mb-4 ml-3 font-semibold text-[var(--text-muted)]">
            Navigation
          </p>

          <nav className="flex-1 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setIsOpen(false)}
                    className={`w-full flex items-center gap-3.5 px-5 py-3 rounded-xl transition-all duration-300 font-medium ${
                      isActive ? "" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                    }`}
                    style={isActive ? {
                      background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                      boxShadow: "0 8px 28px color-mix(in srgb, var(--active-end) 35%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--active-end) 35%, transparent)",
                      color: "var(--active-text)",
                      borderLeft: "3px solid var(--active-end)",
                    } : undefined}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "drop-shadow-[0_0_4px_var(--accent-glow)]" : ""}`} />
                    {item.title}
                  </button>
                </Link>
              );
            })}
          </nav>

          <div className="pt-5 mt-5" style={{ borderTop: "1px solid var(--border)" }}>
            <a
              href="https://deepsikha-ai.vercel.app/ai-assistant"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="w-full flex items-center gap-3.5 px-5 py-3 rounded-xl bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-all duration-300 font-medium border border-[var(--border)]">
                <Sparkles className="h-5 w-5 text-[var(--color-purple)]" />
                AI Assistant
              </button>
            </a>
          </div>

          <div className="pt-5" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={handleLogout}
              onMouseEnter={() => setLogoutHovered(true)}
              onMouseLeave={() => setLogoutHovered(false)}
              className="w-full flex items-center gap-3.5 px-5 py-3 rounded-xl transition-all duration-300 font-medium"
              style={{
                background: logoutHovered
                  ? "color-mix(in srgb, var(--color-danger) 20%, transparent)"
                  : "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                color: "var(--color-danger)",
              }}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>

        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
