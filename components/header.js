"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Bell,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Check,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header({ onMobileMenuToggle, isMobileMenuOpen }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [hasNotifications] = useState(true);
  const menuRef = useRef(null);

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
    <header className="sticky top-0 z-40 w-full bg-[#0A0F1A]/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="flex items-center justify-between h-16 px-4 md:px-8">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 text-white/60 hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 hidden md:block" />

        <div className="flex items-center gap-4">
          <button className="relative p-2 rounded-lg text-white/50 hover:text-[#00FF88] hover:bg-white/[0.06] transition-all duration-200">
            <Bell className="w-5 h-5" strokeWidth={1.5} />
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#00FF88] rounded-full ring-2 ring-[#0A0F1A] animate-pulse-soft" />
            )}
          </button>

          <div className="w-px h-6 bg-white/[0.08]" />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.06] transition-colors duration-200 group"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FF88] to-[#00CC70] flex items-center justify-center text-[#0B1220] font-bold text-sm shadow-md shadow-[#00FF88]/20">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white leading-none">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-white/40 leading-none mt-1">
                  {user?.role || "User"}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0F1A2E] backdrop-blur-xl rounded-xl shadow-glass border border-white/[0.08] overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
                  <p className="text-sm font-medium text-white">
                    {user?.name}
                  </p>
                  <p className="text-xs text-white/50 mt-1">{user?.email}</p>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors duration-200 text-sm font-medium"
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors duration-200 text-sm font-medium">
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-white/[0.06] p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-colors duration-200 text-sm font-medium"
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
