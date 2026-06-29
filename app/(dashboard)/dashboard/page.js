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

/* ─── Badge colour helpers ─── */
const badgeStyle = (clr, bg = "0.12", bd = "0.22") => ({
  background: `color-mix(in srgb, ${clr} ${Math.round(parseFloat(bg) * 100)}%, transparent)`,
  color: clr,
  border: `1px solid color-mix(in srgb, ${clr} ${Math.round(parseFloat(bd) * 100)}%, transparent)`,
});

/* ─── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ title, value, icon, trend, trendUp, accent, href }) {
  const accentMap = {
    purple: "var(--color-success)",
    emerald: "var(--color-success)",
    amber: "var(--color-warning)",
    blue: "var(--color-info)",
  };
  const a = accentMap[accent] || "var(--color-success)";

  const cardContent = (
    <div
      className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 cursor-default"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${a} 18%, transparent) 0%, color-mix(in srgb, ${a} 8%, transparent) 100%)`,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
        backdropFilter: "blur(20px)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
      }}
    >
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: "var(--bg-muted)" }} />
      <div className="absolute -bottom-6 -left-2 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: "color-mix(in srgb, var(--bg-muted) 50%, transparent)" }} />

      <div className="relative flex justify-between items-start">
        <div className="flex-1">
          <p className="text-[11px] font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--text-muted)" }}>
            {title}
          </p>
          <p className="text-4xl font-bold mb-3 leading-none"
            style={{ color: "var(--text-primary)" }}>
            {value}
          </p>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-secondary)",
            }}
          >
            {trendUp ? "\u2191" : "\u2192"} {trend}
          </span>
        </div>
        <div
          className="p-3 rounded-xl shadow-lg"
          style={{
            background: `color-mix(in srgb, ${a} 18%, transparent)`,
            color: a,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{cardContent}</Link>;
  return cardContent;
}

/* ─── Card ───────────────────────────────────────────────────────── */
function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
        backdropFilter: "blur(20px)",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Card Header ────────────────────────────────────────────────── */
function CardHeader({ title, subtitle, action }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ─── Status Badge ────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    Completed:   { clr: "var(--color-success)" },
    "In Progress": { clr: "var(--color-info)" },
    Pending:     { clr: "var(--color-warning)" },
    Overdue:     { clr: "var(--color-danger)" },
  };
  const c = map[status] || { clr: "var(--text-muted)" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={badgeStyle(c.clr)}
    >
      {status}
    </span>
  );
}

/* ─── Priority Badge ─────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const map = {
    Critical: { clr: "var(--color-danger)" },
    High:     { clr: "var(--color-warning)" },
    Medium:   { clr: "var(--color-info)" },
    Low:      { clr: "var(--color-success)" },
  };
  const c = map[priority] || { clr: "var(--text-muted)" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={badgeStyle(c.clr)}
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
      backgroundColor: "var(--bg-surface)",
      padding: 12,
      titleColor: "var(--text-primary)",
      bodyColor: "var(--text-secondary)",
      borderColor: "var(--border)",
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
              backgroundColor: ["var(--color-success)", "var(--color-warning)", "var(--color-info)"],
              borderColor: "var(--bg-base)",
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
                color: "var(--text-muted)",
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

      const gradPurple = ctx.createLinearGradient(0, 0, 0, 300);
      gradPurple.addColorStop(0, "color-mix(in srgb, var(--color-success) 20%, transparent)");
      gradPurple.addColorStop(1, "color-mix(in srgb, var(--color-success) 0%, transparent)");

      const gradBlue = ctx.createLinearGradient(0, 0, 0, 300);
      gradBlue.addColorStop(0, "color-mix(in srgb, var(--color-info) 15%, transparent)");
      gradBlue.addColorStop(1, "color-mix(in srgb, var(--color-info) 0%, transparent)");

      chartInstances.current.taskTrend = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Completed",
              data: trendData.map((t) => t.completed),
              borderColor: "var(--color-success)",
              backgroundColor: gradPurple,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "var(--color-success)",
              pointBorderColor: "var(--bg-base)",
              pointBorderWidth: 2,
            },
            {
              label: "New Tasks",
              data: trendData.map((t) => t.created),
              borderColor: "var(--color-info)",
              backgroundColor: gradBlue,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: "var(--color-info)",
              pointBorderColor: "var(--bg-base)",
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
                color: "var(--text-muted)",
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
                    grid: { color: "var(--border)" },
                    ticks: { color: "var(--text-muted)", font },
                    border: { display: false },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: "var(--text-muted)", font },
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
                "var(--color-success)",
                "var(--color-info)",
                "var(--color-purple)",
                "var(--color-warning)",
                "var(--color-danger)",
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
                    grid: { color: "var(--border)" },
                    ticks: { color: "var(--text-muted)", font },
                    border: { display: false },
                  },
                  y: {
                    grid: { display: false },
                    ticks: { color: "var(--text-secondary)", font: { ...font, weight: "500" } },
                    border: { display: false },
                  },
          },
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 animate-spin mx-auto mb-4"
            style={{
              borderColor: "var(--border)",
              borderTopColor: "var(--color-success)",
            }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Loading dashboard\u2026
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* ── Top Header Bar ── */}
      <div
        className="sticky top-0 z-20 backdrop-blur-xl px-8 py-4 flex items-center justify-between"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center rounded-xl p-1 gap-1"
            style={{
              backgroundColor: "var(--bg-muted)",
              border: "1px solid var(--border)",
            }}>
            <button
              onClick={() => setViewMode("table")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={
                viewMode === "table"
                  ? {
                      background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                      color: "var(--active-text)",
                      fontWeight: 600,
                      boxShadow: "0 4px 14px color-mix(in srgb, var(--active-end) 40%, transparent)",
                    }
                  : { color: "var(--text-muted)" }
              }
              onMouseEnter={(e) => {
                if (viewMode !== "table") e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (viewMode !== "table") e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <List size={14} />
              Table
            </button>
            <button
              onClick={() => setViewMode("graphs")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={
                viewMode === "graphs"
                  ? {
                      background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                      color: "var(--active-text)",
                      fontWeight: 600,
                      boxShadow: "0 4px 14px color-mix(in srgb, var(--active-end) 40%, transparent)",
                    }
                  : { color: "var(--text-muted)" }
              }
              onMouseEnter={(e) => {
                if (viewMode !== "graphs") e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (viewMode !== "graphs") e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <BarChart2 size={14} />
              Graphs
            </button>
          </div>

          {/* Filter toggle */}
          {isAdminOrManager && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all duration-200"
              style={
                showFilters
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--active-end) 12%, transparent)",
                      borderColor: "color-mix(in srgb, var(--active-end) 35%, transparent)",
                      color: "var(--active-text)",
                    }
                  : {
                      backgroundColor: "var(--bg-muted)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }
              }
              onMouseEnter={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--active-end) 30%, transparent)";
                  e.currentTarget.style.color = "var(--active-text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              <Filter size={14} />
              Filters
            </button>
          )}

          {isAdminOrManager && (
            <Link href="/tasks">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                  color: "var(--active-text)",
                  boxShadow: "0 4px 14px color-mix(in srgb, var(--active-end) 40%, transparent)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <Plus size={15} />
                New Task
              </button>
            </Link>
          )}

          {/* User chip */}
          <div className="flex items-center gap-2 pl-3"
            style={{ borderLeft: "1px solid var(--border)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg bg-avatar"
              style={{
                background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                color: "var(--text-inverse)",
              }}>
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold leading-tight"
                style={{ color: "var(--text-primary)" }}>
                {user?.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{user?.role}</p>
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
          <div className="mb-6 rounded-2xl p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card)",
              backdropFilter: "blur(20px)",
            }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</h3>
              <button
                onClick={() => {
                  setSelectedUser("all");
                  setTimePeriod("month");
                  setStatusFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="flex items-center gap-1.5 text-xs font-medium hover:underline"
                style={{ color: "var(--color-success)" }}
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] font-semibold tracking-widest uppercase block mb-1.5"
                  style={{ color: "var(--text-muted)" }}>
                  User
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="input-field text-sm"
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
                <label className="text-[10px] font-semibold tracking-widest uppercase block mb-1.5"
                  style={{ color: "var(--text-muted)" }}>
                  Period
                </label>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="input-field text-sm"
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
                    <label className="text-[10px] font-semibold tracking-widest uppercase block mb-1.5"
                      style={{ color: "var(--text-muted)" }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-semibold tracking-widest uppercase block mb-1.5"
                      style={{ color: "var(--text-muted)" }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                </>
              )}
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-semibold tracking-widest uppercase block mb-1.5"
                  style={{ color: "var(--text-muted)" }}>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field text-sm"
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
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--text-muted)" }}>
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
                    <span className="text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full border"
                      style={{
                        color: "var(--color-success)",
                        backgroundColor: "color-mix(in srgb, var(--color-success) 8%, transparent)",
                        borderColor: "color-mix(in srgb, var(--color-success) 20%, transparent)",
                      }}>
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
                      <tr className="table-head">
                        {[
                          "Task",
                          "Status",
                          "Priority",
                          "Assigned To",
                          "Deadline",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left first:pl-6 last:pr-6"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y"
                      style={{ borderColor: "var(--border)" }}>
                      {dashboardTasks.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "var(--bg-muted)" }}>
                                <CheckSquare
                                  size={28}
                                  style={{ color: "var(--text-muted)" }}
                                />
                              </div>
                              <p className="text-sm font-medium"
                                style={{ color: "var(--text-secondary)" }}>
                                No tasks found
                              </p>
                              <p className="text-xs"
                                style={{ color: "var(--text-muted)" }}>
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
                              className="table-row-hover transition-colors group"
                            >
                              <td className="px-5 py-3.5 pl-6 max-w-xs">
                                <p className="font-medium text-sm truncate"
                                  style={{ color: "var(--text-primary)" }}>
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs mt-0.5 truncate"
                                    style={{ color: "var(--text-muted)" }}>
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
                                        className="text-xs font-medium px-2 py-0.5 rounded-md border"
                                        style={{
                                          color: "var(--color-info)",
                                          backgroundColor: "color-mix(in srgb, var(--color-info) 8%, transparent)",
                                          borderColor: "color-mix(in srgb, var(--color-info) 20%, transparent)",
                                        }}
                                      >
                                        {u.name || "User"}
                                      </span>
                                    ))}
                                    {task.assignedTo.length > 2 && (
                                      <span className="text-xs font-medium px-2 py-0.5 rounded-md border"
                                        style={{
                                          color: "var(--text-secondary)",
                                          backgroundColor: "var(--bg-muted)",
                                          borderColor: "var(--border)",
                                        }}>
                                        +{task.assignedTo.length - 2}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 pr-6">
                                <span className="text-xs font-medium"
                                  style={{ color: "var(--text-secondary)" }}>
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
                <Card>
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
                      icon: "\uD83D\uDCCB",
                    },
                    {
                      label: "Performance Data",
                      href: "/performance",
                      icon: "\uD83D\uDCCA",
                    },
                  ].map(({ label, href, icon }) => (
                    <Link key={href} href={href} className="no-underline">
                      <div
                        className="px-4 py-4 rounded-xl flex items-center justify-between transition-all group"
                        style={{
                          backgroundColor: "var(--bg-muted)",
                          border: "1px solid var(--border)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-success) 30%, transparent)";
                          e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.backgroundColor = "var(--bg-muted)";
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{icon}</span>
                          <span className="text-sm font-medium"
                            style={{ color: "var(--text-primary)" }}>
                            {label}
                          </span>
                        </div>
                        <ArrowUpRight
                          size={16}
                          style={{ color: "var(--text-muted)" }}
                          className="transition-colors"
                          onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-success)"}
                          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
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
            <div
              className="relative overflow-hidden rounded-2xl p-5"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--color-success) 18%, transparent) 0%, color-mix(in srgb, var(--color-success) 8%, transparent) 100%)",
                border: "1px solid color-mix(in srgb, var(--color-success) 22%, transparent)",
                boxShadow: "var(--shadow-card)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
                style={{ background: "var(--bg-muted)" }} />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full pointer-events-none"
                style={{ background: "color-mix(in srgb, var(--bg-muted) 50%, transparent)" }} />
              <div className="relative">
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-1"
                  style={{ color: "color-mix(in srgb, var(--color-success) 60%, transparent)" }}>
                  Live
                </p>
                <h2 className="text-base font-bold mb-4"
                  style={{ color: "var(--text-primary)" }}>
Today&apos;s Snapshot
                </h2>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      label: "Present Today",
                      value: analytics?.users?.active || 0,
                      icon: "\uD83D\uDC65",
                    },
                    {
                      label: "Overdue Tasks",
                      value: analytics?.tasks?.overdue || 0,
                      icon: "\u26A0\uFE0F",
                    },
                  ].map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="px-4 py-3 rounded-xl flex items-center justify-between"
                      style={{ backgroundColor: "var(--bg-muted)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="text-xs font-medium"
                          style={{ color: "var(--text-secondary)" }}>
                          {label}
                        </span>
                      </div>
                      <span className="text-2xl font-bold"
                        style={{ color: "var(--text-primary)" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Completion ring */}
                <div className="mt-4 pt-4"
                  style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium"
                      style={{ color: "var(--text-muted)" }}>
                      Completion Rate
                    </span>
                    <span className="text-sm font-bold"
                      style={{ color: "var(--color-success)" }}>
                      {completionRate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--bg-muted)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${completionRate}%`,
                        background: "linear-gradient(90deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Card */}
            <Card>
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-3"
                  style={{ color: "var(--text-muted)" }}>
                  Account
                </p>
                <div className="flex items-center gap-3 mb-4 pb-4"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg bg-avatar"
                    style={{
                      background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                      color: "var(--text-inverse)",
                      boxShadow: "0 4px 12px color-mix(in srgb, var(--color-success) 20%, transparent)",
                    }}>
                    {user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}>
                      {user?.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{user?.email}</p>
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
                      <span className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}>
                        {label}
                      </span>
                      <span className="text-xs font-medium"
                        style={{ color: "var(--text-primary)" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/profile" className="no-underline block mt-4">
                  <button
                    className="w-full py-2.5 rounded-xl text-xs font-medium transition-all duration-150"
                    style={{
                      backgroundColor: "var(--bg-muted)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
                      e.currentTarget.style.borderColor = "var(--border-hover)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-muted)";
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    View Full Profile
                  </button>
                </Link>
              </div>
            </Card>

            {/* Quick Actions */}
            {isAdminOrManager && (
              <Card>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-3"
                    style={{ color: "var(--text-muted)" }}>
                    Shortcuts
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        label: "Manage Tasks",
                        href: "/tasks",
                        icon: <CheckSquare size={15} />,
                        accent: "var(--color-success)",
                      },
                      ...(user?.role === "Admin"
                        ? [
                            {
                              label: "Manage Users",
                              href: "/users",
                              icon: <Users size={15} />,
                              accent: "var(--color-info)",
                            },
                          ]
                        : []),
                    ].map(({ label, href, icon, accent }) => (
                      <Link key={href} href={href} className="no-underline">
                        <div
                          className="px-4 py-3 rounded-xl flex items-center gap-3 transition-all group cursor-pointer"
                          style={{
                            backgroundColor: "var(--bg-muted)",
                            border: "1px solid var(--border)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-success) 25%, transparent)";
                            e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--border)";
                            e.currentTarget.style.backgroundColor = "var(--bg-muted)";
                          }}
                        >
                          <span
                            className="p-1.5 rounded-lg"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
                              color: accent,
                            }}
                          >
                            {icon}
                          </span>
                          <span className="text-sm font-medium flex-1"
                            style={{ color: "var(--text-primary)" }}>
                            {label}
                          </span>
                          <ArrowUpRight
                            size={14}
                            style={{ color: "var(--text-muted)" }}
                            className="transition-colors"
                            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-success)"}
                            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
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
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-1"
                  style={{ color: "var(--text-muted)" }}>
                  Updates
                </p>
                <h3 className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-primary)" }}>
                  Recent Activity
                </h3>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {recentActivities.slice(0, 5).map((activity, i) => (
                    <div
                      key={activity._id || i}
                      className="px-3 py-2.5 rounded-xl"
                      style={{
                        backgroundColor: "var(--bg-muted)",
                        border: "1px solid var(--border)",
                        borderLeft: "3px solid var(--color-success)",
                      }}
                    >
                      <p className="text-xs font-medium mb-0.5 leading-snug"
                        style={{ color: "var(--text-primary)" }}>
                        {activity.description}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {activity.createdAt
                          ? new Date(activity.createdAt).toLocaleString()
                          : "Just now"}
                      </p>
                    </div>
                  ))}
                  {recentActivities.length === 0 && (
                    <p className="text-xs text-center py-6"
                      style={{ color: "var(--text-muted)" }}>
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
