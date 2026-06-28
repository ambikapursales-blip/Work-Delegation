"use client";

import { useState, useEffect } from "react";
import { usersAPI } from "@/lib/api";
import { Loading } from "@/components/loading";
import { Mail, Building2, Edit, Trash2, Phone } from "lucide-react";

const ROLE_STYLES = {
  Admin: {
    badge: "bg-[#FF6B6B]/15 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/25",
    avatar: "bg-[#FF6B6B]/10 text-[#FF6B6B]",
    bar: "bg-[#FF6B6B]",
  },
  HR: {
    badge: "bg-[#B366FF]/15 text-[#B366FF] ring-1 ring-[#B366FF]/25",
    avatar: "bg-[#B366FF]/10 text-[#B366FF]",
    bar: "bg-[#B366FF]",
  },
  Manager: {
    badge: "bg-[#00D4FF]/15 text-[#00D4FF] ring-1 ring-[#00D4FF]/25",
    avatar: "bg-[#00D4FF]/10 text-[#00D4FF]",
    bar: "bg-[#00D4FF]",
  },
  "Sales Executive": {
    badge: "bg-[#00FF88]/15 text-[#00FF88] ring-1 ring-[#00FF88]/25",
    avatar: "bg-[#00FF88]/10 text-[#00FF88]",
    bar: "bg-[#00FF88]",
  },
  Coordinator: {
    badge: "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25",
    avatar: "bg-[#FFB84D]/10 text-[#FFB84D]",
    bar: "bg-[#FFB84D]",
  },
};

const DEFAULT_STYLE = {
  badge: "bg-white/10 text-white/60 ring-1 ring-white/10",
  avatar: "bg-white/5 text-white/50",
  bar: "bg-white/20",
};

const FILTERS = [
  "All",
  "Admin",
  "HR",
  "Manager",
  "Sales Executive",
  "Coordinator",
];

function UserCard({ user }) {
  const style = ROLE_STYLES[user.role] || DEFAULT_STYLE;
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group relative bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/[0.06] hover:border-white/[0.12] hover:shadow-glass hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col">
      <div className={`h-1 w-full ${style.bar}`} />

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${style.avatar}`}
          >
            {initials}
          </div>
          <span
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${style.badge}`}
          >
            {user.role}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-white/85 mb-3 leading-snug">
          {user.name}
        </h3>

        <div className="space-y-1.5 text-xs text-white/50 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-3.5 h-3.5 shrink-0 text-white/30" />
            <span className="truncate">{user.email}</span>
          </div>

          {user.department && (
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 shrink-0 text-white/30" />
              <span>{user.department}</span>
            </div>
          )}

          {user.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0 text-white/30" />
              <span>{user.phone}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] flex gap-2">
          <button className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/70 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg px-3 py-2 transition-colors">
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#FF6B6B] bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 rounded-lg px-3 py-2 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered =
    activeFilter === "All"
      ? users
      : users.filter((u) => u.role === activeFilter);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Team Members
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Manage your organisation users
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
          <p className="text-xs text-white/40 uppercase tracking-wide">
            {activeFilter === "All" ? "Total Users" : activeFilter}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((role) => (
          <button
            key={role}
            onClick={() => setActiveFilter(role)}
            className={`text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all ${
              activeFilter === role
                ? "bg-[#00FF88] text-[#0B1220] border-[#00FF88] font-semibold"
                : "bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/80"
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((user) => (
            <UserCard key={user._id} user={user} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <p className="text-sm text-white/40">No users found</p>
        </div>
      )}
    </div>
  );
}
