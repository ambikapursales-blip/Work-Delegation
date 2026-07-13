"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { actionCenterAPI } from "@/lib/api";
import {
  Bell,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Check,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header({ onMobileMenuToggle, isMobileMenuOpen }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [logOutHovered, setLogOutHovered] = useState(false);
  const menuRef = useRef(null);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await actionCenterAPI.getItems({ filter: "pending" });
      setPendingCount(res.data.pendingCount || 0);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full" style={{ backgroundColor: "color-mix(in srgb, var(--bg-base) 85%, transparent)", borderBottom: "1px solid var(--border)", boxShadow: "var(--header-shadow)" }}>
      <div className="flex items-center justify-between h-16 px-4 md:px-8">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] rounded-lg transition-colors"
          >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 hidden md:block" />

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-warning)] hover:bg-[var(--bg-muted)] transition-all duration-200"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Moon className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
          <Link
            href="/dwr"
            className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-success)] hover:bg-[var(--bg-muted)] transition-all duration-200"
          >
            <Bell className="w-5 h-5" strokeWidth={1.5} />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-[var(--color-danger)] ring-2 ring-[var(--bg-base)]" style={{ padding: "0 4px" }}>
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </Link>

          <div className="w-px h-6 bg-[var(--border)]" />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-muted)] transition-colors duration-200 group"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[#1E3A8A]/20 bg-avatar">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-none">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-none mt-1">
                  {user?.role || "User"}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-surface)] backdrop-blur-xl rounded-xl shadow-glass border overflow-hidden animate-slide-up" style={{ borderColor: "var(--border)" }}>
                  <div className="px-4 py-3 border-b bg-[var(--bg-muted)]" style={{ borderBottomColor: "var(--border)" }}>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {user?.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{user?.email}</p>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 text-sm font-medium"
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 text-sm font-medium">
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>

                <div className="p-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={handleLogout}
                    onMouseEnter={() => setLogOutHovered(true)}
                    onMouseLeave={() => setLogOutHovered(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium"
                    style={{
                      color: "var(--color-danger)",
                      background: logOutHovered ? "color-mix(in srgb, var(--color-danger) 10%, transparent)" : "transparent",
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
