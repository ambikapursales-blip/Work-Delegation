"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  CheckCircle2,
  Users,
  Plus,
  Clock,
  CheckSquare,
  ArrowUpRight,
  BarChart2,
  List,
  Filter,
  RefreshCw,
} from "lucide-react";
import { dashboardAPI, reportsAPI, taskAPI, usersAPI } from "@/lib/api";
import Link from "next/link";
import Toast from "@/components/Toast";

/* ─── Design Tokens ─────────────────────────────────────────────── */
const T = {
  primary: "#00FF88",
  primaryDark: "#00CC70",
  primaryLight: "#33FFA3",
  primaryGradStart: "#00FF88",
  primaryGradEnd: "#00CC70",
  primaryBg: "rgba(0,255,136,0.1)",
  primaryBorder: "rgba(0,255,136,0.25)",

  pageBg: "#0B1220",
  surface: "rgba(255,255,255,0.04)",
  surfaceAlt: "rgba(255,255,255,0.02)",

  ink1: "#FFFFFF",
  ink2: "rgba(255,255,255,0.85)",
  ink3: "rgba(255,255,255,0.5)",
  ink4: "rgba(255,255,255,0.35)",

  emerald: "#00FF88",
  emeraldLight: "rgba(0,255,136,0.12)",
  emeraldBorder: "rgba(0,255,136,0.25)",

  amber: "#FFB84D",
  amberLight: "rgba(255,184,77,0.12)",
  amberBorder: "rgba(255,184,77,0.25)",

  rose: "#FF6B6B",
  roseLight: "rgba(255,107,107,0.12)",
  roseBorder: "rgba(255,107,107,0.25)",

  blue: "#00D4FF",
  blueLight: "rgba(0,212,255,0.12)",
  blueBorder: "rgba(0,212,255,0.25)",

  border1: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.12)",
};

/* ─── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ title, value, icon, trend, trendUp, accent, href }) {
  const variants = {
    purple: {
      gradient: "from-[#00FF88]/20 to-[#00CC70]/10",
      iconBg: "bg-[#00FF88]/20 text-[#0B1220]",
      trendBg: "bg-white/10 text-white",
      textColor: "text-[#00FF88]",
      border: "border-[#00FF88]/20",
    },
    emerald: {
      gradient: "from-[#00FF88]/20 to-[#00CC70]/10",
      iconBg: "bg-[#00FF88]/20 text-[#0B1220]",
      trendBg: "bg-white/10 text-white",
      textColor: "text-[#00FF88]",
      border: "border-[#00FF88]/20",
    },
    amber: {
      gradient: "from-[#FFB84D]/20 to-[#FF9500]/10",
      iconBg: "bg-[#FFB84D]/20 text-[#0B1220]",
      trendBg: "bg-white/10 text-white",
      textColor: "text-[#FFB84D]",
      border: "border-[#FFB84D]/20",
    },
    blue: {
      gradient: "from-[#00D4FF]/20 to-[#0099CC]/10",
      iconBg: "bg-[#00D4FF]/20 text-[#0B1220]",
      trendBg: "bg-white/10 text-white",
      textColor: "text-[#00D4FF]",
      border: "border-[#00D4FF]/20",
    },
  };
  const v = variants[accent] || variants.purple;

  const cardContent = (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${v.gradient} backdrop-blur-xl border border-white/[0.06] p-5 shadow-glass-sm ${href ? "hover:-translate-y-1 cursor-pointer hover:shadow-glass" : "cursor-default"} transition-all duration-300`}
    >
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/[0.03] pointer-events-none" />
      <div className="absolute -bottom-6 -left-2 w-16 h-16 rounded-full bg-white/[0.02] pointer-events-none" />

      <div className="relative flex justify-between items-start">
        <div className="flex-1">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-white/50 mb-2">
            {title}
          </p>
          <p className="text-4xl font-bold text-white mb-3 leading-none">
            {value}
          </p>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${v.trendBg}`}
          >
            {trendUp ? "↑" : "→"} {trend}
          </span>
        </div>
        <div className={`p-3 rounded-xl ${v.iconBg} shadow-lg`}>{icon}</div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}

/* ─── Card ───────────────────────────────────────────────────────── */
function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Card Header ────────────────────────────────────────────────── */
function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ─── Status Badge ────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    Completed: "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
    "In Progress": "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
    Pending: "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
    Overdue: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] || "bg-white/10 text-white/60 border-white/10"}`}
    >
      {status}
    </span>
  );
}

/* ─── Priority Badge ─────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const map = {
    Critical: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
    High: "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
    Medium: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
    Low: "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[priority] || "bg-white/10 text-white/60 border-white/10"}`}
    >
      {priority}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalUsers: 0,
    presentToday: 0,
    eventsCount: 0,
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentActivities, setRecentActivities] = useState([]);
  const [dashboardTasks, setDashboardTasks] = useState([]);
  const [viewMode, setViewMode] = useState("table");

  const [selectedUser, setSelectedUser] = useState("all");
  const [timePeriod, setTimePeriod] = useState("month");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usersList, setUsersList] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const chartRefs = {
    taskProgress: useRef(null),
    taskTrend: useRef(null),
    departmentStats: useRef(null),
  };
  const chartInstances = useRef({});

  const isAdminOrManager = ["Admin", "Manager"].includes(user?.role);
  const isHR = user?.role === "HR";
  const completionRate =
    analytics?.tasks?.total > 0
      ? Math.round((analytics.tasks.completed / analytics.tasks.total) * 100)
      : 0;

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      let period = timePeriod;
      let customStartDate, customEndDate;

      if (timePeriod === "today") {
        const now = new Date();
        customStartDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        customStartDate.setHours(0, 0, 0, 0);
        customEndDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        customEndDate.setHours(23, 59, 59, 999);
      } else if (timePeriod === "custom" && startDate && endDate) {
        customStartDate = new Date(startDate);
        customStartDate.setHours(0, 0, 0, 0);
        customEndDate = new Date(endDate);
        customEndDate.setHours(23, 59, 59, 999);
      }

      const [response, analyticsRes, activitiesRes, tasksRes] = await Promise.all([
        dashboardAPI.getStats({
          userId: selectedUser === "all" ? undefined : selectedUser,
          status: statusFilter === "all" ? undefined : statusFilter,
          period,
          startDate: customStartDate?.toISOString(),
          endDate: customEndDate?.toISOString(),
        }),
        reportsAPI.getDashboardAnalytics({
          period,
          userId: selectedUser === "all" ? undefined : selectedUser,
          status: statusFilter === "all" ? undefined : statusFilter,
          startDate: customStartDate?.toISOString(),
          endDate: customEndDate?.toISOString(),
        }),
        dashboardAPI.getRecentActivities(),
        taskAPI.getTasks({
          userId: selectedUser === "all" ? undefined : selectedUser,
          status: statusFilter === "all" ? undefined : statusFilter,
          period,
          startDate: customStartDate?.toISOString(),
          endDate: customEndDate?.toISOString(),
        }),
      ]);

      const statsData = response.data?.stats;
      setStats({
        totalTasks: statsData?.tasks?.total || 0,
        completedTasks: statsData?.tasks?.completed || 0,
        pendingTasks: statsData?.tasks?.pending || 0,
        inProgressTasks: statsData?.tasks?.inProgress || 0,
        totalUsers: statsData?.users?.total || 0,
        presentToday: statsData?.users?.active || 0,
        eventsCount: 0,
      });

      setAnalytics(analyticsRes.data?.analytics || null);
      setRecentActivities(activitiesRes.data?.activities || []);
      setDashboardTasks(tasksRes.data?.tasks || []);

      if (isAdminOrManager) {
        try {
          const usersRes = await usersAPI.getAll();
          setUsersList(usersRes.data?.users || []);
        } catch (err) {
          console.error("Failed to fetch users:", err);
        }
      }
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [timePeriod, selectedUser, statusFilter, startDate, endDate, isAdminOrManager]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!loading && analytics && viewMode === "graphs") {
      initializeCharts().catch(console.error);
    }
    const instances = chartInstances.current;
    return () => Object.values(instances).forEach((c) => c?.destroy());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stats,
    analytics,
    loading,
    timePeriod,
    selectedUser,
    statusFilter,
    viewMode,
  ]);

  const initializeCharts = async () => {
    const { default: Chart } = await import("chart.js/auto");
    const font = { family: "Inter, system-ui, sans-serif", size: 12 };
    const tooltipDefaults = {
      backgroundColor: "#0F1A2E",
      padding: 12,
      titleColor: "#FFFFFF",
      bodyColor: "rgba(255,255,255,0.7)",
      borderColor: "rgba(0,255,136,0.3)",
      borderWidth: 1,
      cornerRadius: 10,
    };

    if (chartRefs.taskProgress.current) {
      const ctx = chartRefs.taskProgress.current.getContext("2d");
      chartInstances.current.taskProgress?.destroy();
      chartInstances.current.taskProgress = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Completed", "Pending", "In Progress"],
          datasets: [
            {
              data: [
                analytics?.tasks?.completed || 0,
                analytics?.tasks?.pending || 0,
                analytics?.tasks?.inProgress || 0,
              ],
              backgroundColor: ["#00FF88", "#FFB84D", "#00D4FF"],
              borderColor: "#0B1220",
              borderWidth: 4,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "75%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#6B7280",
                font,
                padding: 16,
                usePointStyle: true,
                pointStyleWidth: 8,
              },
            },
            tooltip: tooltipDefaults,
          },
        },
      });
    }

    if (
      chartRefs.taskTrend.current &&
      analytics?.trends?.taskCompletion?.length > 0
    ) {
      const ctx = chartRefs.taskTrend.current.getContext("2d");
      chartInstances.current.taskTrend?.destroy();
      const trendData = analytics.trends.taskCompletion;
      const labels = trendData.map((t) =>
        new Date(t.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      );

      // Create gradient
      const gradPurple = ctx.createLinearGradient(0, 0, 0, 300);
      gradPurple.addColorStop(0, "rgba(0,255,136,0.2)");
      gradPurple.addColorStop(1, "rgba(0,255,136,0)");

      const gradBlue = ctx.createLinearGradient(0, 0, 0, 300);
      gradBlue.addColorStop(0, "rgba(0,212,255,0.15)");
      gradBlue.addColorStop(1, "rgba(0,212,255,0)");

      chartInstances.current.taskTrend = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Completed",
              data: trendData.map((t) => t.completed),
              borderColor: "#00FF88",
              backgroundColor: gradPurple,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "#00FF88",
              pointBorderColor: "#0B1220",
              pointBorderWidth: 2,
            },
            {
              label: "New Tasks",
              data: trendData.map((t) => t.created),
              borderColor: "#00D4FF",
              backgroundColor: gradBlue,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "#00D4FF",
              pointBorderColor: "#0B1220",
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#6B7280",
                font,
                padding: 16,
                usePointStyle: true,
                pointStyleWidth: 8,
              },
            },
            tooltip: { ...tooltipDefaults, mode: "index", intersect: false },
          },
          scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "rgba(255,255,255,0.4)", font },
                    border: { display: false },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: "rgba(255,255,255,0.4)", font },
                    border: { display: false },
                  },
          },
        },
      });
    }

    if (
      chartRefs.departmentStats.current &&
      analytics?.departments?.length > 0
    ) {
      const ctx = chartRefs.departmentStats.current.getContext("2d");
      chartInstances.current.departmentStats?.destroy();
      const deptData = analytics.departments;
      chartInstances.current.departmentStats = new Chart(ctx, {
        type: "bar",
        data: {
          labels: deptData.map((d) => d.label),
          datasets: [
            {
              label: "Tasks",
              data: deptData.map((d) => d.value),
              backgroundColor: [
                "#00FF88",
                "#00D4FF",
                "#B366FF",
                "#FFB84D",
                "#FF6B6B",
              ],
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: tooltipDefaults },
          scales: {
                  x: {
                    beginAtZero: true,
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "rgba(255,255,255,0.4)", font },
                    border: { display: false },
                  },
                  y: {
                    grid: { display: false },
                    ticks: { color: "rgba(255,255,255,0.6)", font: { ...font, weight: "500" } },
                    border: { display: false },
                  },
          },
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00FF88] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-white/60">
            Loading dashboard…
          </p>
        </div>
      </div>
    );
  }

  const selectClass =
    "w-full px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30 focus:border-[#00FF88]/50 transition-all";
  const inputClass =
    "w-full px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30 focus:border-[#00FF88]/50 transition-all";

  return (
    <div className="min-h-screen bg-[#0B1220]">
      {/* ── Top Header Bar ── */}
      <div className="bg-[#0A0F1A]/80 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-glass-sm">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold tracking-widest uppercase text-white/40">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white/[0.05] rounded-xl p-1 gap-1 border border-white/[0.06]">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                viewMode === "table"
                  ? "bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] font-semibold shadow-neon"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <List size={14} />
              Table
            </button>
            <button
              onClick={() => setViewMode("graphs")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                viewMode === "graphs"
                  ? "bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] font-semibold shadow-neon"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <BarChart2 size={14} />
              Graphs
            </button>
          </div>

          {/* Filter toggle */}
          {isAdminOrManager && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${
                showFilters
                  ? "bg-[#00FF88]/10 border-[#00FF88]/25 text-[#00FF88]"
                  : "bg-white/[0.04] border-white/[0.1] text-white/60 hover:border-[#00FF88]/30 hover:text-[#00FF88]"
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          )}

          {isAdminOrManager && (
            <Link href="/tasks">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] text-xs font-bold shadow-neon hover:scale-[1.02] hover:shadow-neon-lg transition-all duration-200">
                <Plus size={15} />
                New Task
              </button>
            </Link>
          )}

          {/* User chip */}
          <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF88] to-[#00CC70] flex items-center justify-center text-[#0B1220] text-xs font-bold shadow-lg">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-white leading-tight">
                {user?.name}
              </p>
              <p className="text-[10px] text-white/40">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pt-6 pb-10 max-w-[1440px] mx-auto">
        {error && (
          <Toast type="error" message={error} onClose={() => setError("")} />
        )}

        {/* ── Filters Panel ── */}
        {isAdminOrManager && showFilters && (
          <div className="mb-6 bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 shadow-glass-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Filters</h3>
              <button
                onClick={() => {
                  setSelectedUser("all");
                  setTimePeriod("month");
                  setStatusFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="flex items-center gap-1.5 text-xs text-[#00FF88] font-medium hover:underline"
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] font-semibold tracking-widest uppercase text-white/40 block mb-1.5">
                  User
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All Users</option>
                  {usersList
                    .filter((u) => u.role !== "Admin")
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-semibold tracking-widest uppercase text-white/40 block mb-1.5">
                  Period
                </label>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className={selectClass}
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {timePeriod === "custom" && (
                <>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-semibold tracking-widest uppercase text-white/40 block mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-semibold tracking-widest uppercase text-white/40 block mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              )}
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-semibold tracking-widest uppercase text-white/40 block mb-1.5">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="inprogress">In Progress</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats Row ── */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-3">
            Overview
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Tasks"
              value={analytics?.tasks?.total || 0}
              icon={<CheckSquare size={18} />}
              trend="+12% this month"
              trendUp
              accent="purple"
              href="/tasks"
            />
            <StatCard
              title="Completed"
              value={analytics?.tasks?.completed || 0}
              icon={<CheckCircle2 size={18} />}
              trend={`${completionRate}% completion`}
              trendUp
              accent="emerald"
              href="/tasks?status=completed"
            />
            <StatCard
              title="Pending"
              value={analytics?.tasks?.pending || 0}
              icon={<Clock size={18} />}
              trend={
                analytics?.tasks?.pending > 0 ? "Needs attention" : "All clear"
              }
              accent="amber"
              href="/tasks?status=pending"
            />
            {(isAdminOrManager || isHR) && (
              <StatCard
                title="Active Users"
                value={analytics?.users?.active || 0}
                icon={<Users size={18} />}
                trend="Online now"
                accent="blue"
              />
            )}
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          {/* ── Left Column ── */}
          <div className="flex flex-col gap-6">
            {viewMode === "table" ? (
              /* Tasks Table */
              <Card>
                <CardHeader
                  title="Tasks Overview"
                  subtitle={`Showing ${dashboardTasks.length} tasks`}
                  action={
                    <span className="text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20">
                      {timePeriod === "all"
                        ? "All Time"
                        : timePeriod.charAt(0).toUpperCase() +
                          timePeriod.slice(1)}
                    </span>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/[0.02]">
                        {[
                          "Task",
                          "Status",
                          "Priority",
                          "Assigned To",
                          "Deadline",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[10px] font-semibold text-white/40 uppercase tracking-widest first:pl-6 last:pr-6"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {dashboardTasks.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 rounded-2xl bg-white/[0.05] flex items-center justify-center">
                                <CheckSquare
                                  size={28}
                                  className="text-white/20"
                                />
                              </div>
                              <p className="text-sm font-medium text-white/50">
                                No tasks found
                              </p>
                              <p className="text-xs text-white/30">
                                Try adjusting your filters
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        dashboardTasks.slice(0, 10).map((task) => {
                          const status =
                            task.status?.toLowerCase() === "completed"
                              ? "Completed"
                              : task.isOverdue
                                ? "Overdue"
                                : task.status?.toLowerCase() === "in progress"
                                  ? "In Progress"
                                  : "Pending";

                          return (
                            <tr
                              key={task._id}
                              className="hover:bg-white/[0.03] transition-colors group"
                            >
                              <td className="px-5 py-3.5 pl-6 max-w-xs">
                                <p className="font-medium text-white/85 text-sm truncate">
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs text-white/40 mt-0.5 truncate">
                                    {task.description}
                                  </p>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <StatusBadge status={status} />
                              </td>
                              <td className="px-5 py-3.5">
                                <PriorityBadge priority={task.priority} />
                              </td>
                              <td className="px-5 py-3.5">
                                {task.assignedTo?.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {task.assignedTo.slice(0, 2).map((u, i) => (
                                      <span
                                        key={u._id || u.name || i}
                                        className="text-xs font-medium text-[#00D4FF] bg-[#00D4FF]/10 px-2 py-0.5 rounded-md border border-[#00D4FF]/20"
                                      >
                                        {u.name || "User"}
                                      </span>
                                    ))}
                                    {task.assignedTo.length > 2 && (
                                      <span className="text-xs font-medium text-white/50 bg-white/[0.05] px-2 py-0.5 rounded-md border border-white/[0.06]">
                                        +{task.assignedTo.length - 2}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/30">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 pr-6">
                                <span className="text-xs font-medium text-white/50">
                                  {task.deadline
                                    ? new Date(
                                        task.deadline,
                                      ).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : "No deadline"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              /* Graphs View */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Doughnut */}
                <Card>
                  <CardHeader
                    title="Task Distribution"
                    subtitle="Status breakdown"
                  />
                  <div className="p-6">
                    <canvas ref={chartRefs.taskProgress} />
                  </div>
                </Card>

                {/* Line Chart */}
                <Card>
                  <CardHeader
                    title="Task Trend"
                    subtitle="Completion over time"
                  />
                  <div className="p-6" style={{ height: 280 }}>
                    <canvas ref={chartRefs.taskTrend} />
                  </div>
                </Card>

                {/* Bar Chart */}
                <Card className="lg:col-span-2">
                  <CardHeader
                    title="Department Statistics"
                    subtitle="Tasks per department"
                  />
                  <div className="p-6" style={{ height: 260 }}>
                    <canvas ref={chartRefs.departmentStats} />
                  </div>
                </Card>
              </div>
            )}

            {/* HR Tools */}
            {isHR && (
              <Card>
                <CardHeader
                  title="HR Dashboard"
                  subtitle="Quick access to HR tools"
                />
                <div className="p-5 grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Attendance Records",
                      href: "/attendance",
                      icon: "📋",
                    },
                    {
                      label: "Performance Data",
                      href: "/performance",
                      icon: "📊",
                    },
                  ].map(({ label, href, icon }) => (
                    <Link key={href} href={href} className="no-underline">
                      <div className="px-4 py-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between hover:border-[#00FF88]/30 hover:bg-white/[0.06] transition-all group">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{icon}</span>
                          <span className="text-sm font-medium text-white/85">
                            {label}
                          </span>
                        </div>
                        <ArrowUpRight
                          size={16}
                          className="text-white/30 group-hover:text-[#00FF88] transition-colors"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="flex flex-col gap-5">
            {/* Today's Snapshot */}
            <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#00FF88]/20 to-[#00CC70]/10 backdrop-blur-xl border border-[#00FF88]/20 shadow-glass">
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/[0.03] pointer-events-none" />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/[0.02] pointer-events-none" />
              <div className="relative">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-[#00FF88]/60 mb-1">
                  Live
                </p>
                <h2 className="text-base font-bold text-white mb-4">
Today&apos;s Snapshot
                </h2>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      label: "Present Today",
                      value: analytics?.users?.active || 0,
                      icon: "👥",
                    },
                    {
                      label: "Overdue Tasks",
                      value: analytics?.tasks?.overdue || 0,
                      icon: "⚠️",
                    },
                  ].map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="px-4 py-3 rounded-xl bg-white/[0.06] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="text-xs font-medium text-white/70">
                          {label}
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-white">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Completion ring */}
                <div className="mt-4 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white/60">
                      Completion Rate
                    </span>
                    <span className="text-sm font-bold text-[#00FF88]">
                      {completionRate}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00FF88] to-[#00CC70] rounded-full transition-all duration-700"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Card */}
            <Card>
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-white/30 mb-3">
                  Account
                </p>
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00FF88] to-[#00CC70] flex items-center justify-center text-[#0B1220] text-sm font-bold flex-shrink-0 shadow-lg shadow-[#00FF88]/20">
                    {user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {user?.name}
                    </p>
                    <p className="text-xs text-white/50">{user?.email}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Department", value: user?.department || "N/A" },
                    { label: "Role", value: user?.role },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-center"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                        {label}
                      </span>
                      <span className="text-xs font-medium text-white/80">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/profile" className="no-underline block mt-4">
                  <button className="w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/70 text-xs font-medium hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all duration-150">
                    View Full Profile
                  </button>
                </Link>
              </div>
            </Card>

            {/* Quick Actions */}
            {isAdminOrManager && (
              <Card>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-white/30 mb-3">
                    Shortcuts
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        label: "Manage Tasks",
                        href: "/tasks",
                        icon: <CheckSquare size={15} />,
                        color: "text-[#00FF88] bg-[#00FF88]/10",
                      },
                      ...(user?.role === "Admin"
                        ? [
                            {
                              label: "Manage Users",
                              href: "/users",
                              icon: <Users size={15} />,
                              color: "text-[#00D4FF] bg-[#00D4FF]/10",
                            },
                          ]
                        : []),
                    ].map(({ label, href, icon, color }) => (
                      <Link key={href} href={href} className="no-underline">
                        <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3 hover:border-[#00FF88]/25 hover:bg-white/[0.06] transition-all group cursor-pointer">
                          <span className={`p-1.5 rounded-lg ${color}`}>
                            {icon}
                          </span>
                          <span className="text-sm font-medium text-white/85 flex-1">
                            {label}
                          </span>
                          <ArrowUpRight
                            size={14}
                            className="text-white/30 group-hover:text-[#00FF88] transition-colors"
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Recent Activity */}
            <Card>
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-white/30 mb-1">
                  Updates
                </p>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Recent Activity
                </h3>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {recentActivities.slice(0, 5).map((activity, i) => (
                    <div
                      key={activity._id || i}
                      className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] border-l-2 border-l-[#00FF88]"
                    >
                      <p className="text-xs font-medium text-white/85 mb-0.5 leading-snug">
                        {activity.description}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {activity.createdAt
                          ? new Date(activity.createdAt).toLocaleString()
                          : "Just now"}
                      </p>
                    </div>
                  ))}
                  {recentActivities.length === 0 && (
                    <p className="text-xs text-white/30 text-center py-6">
                      No recent activity
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
