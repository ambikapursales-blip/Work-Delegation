"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { performanceAPI, teamAPI } from "@/lib/api";
import { SkeletonTable, SkeletonChart } from "@/components/skeleton";
import { Trophy, BarChart3, Table2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Cell,
} from "recharts";

const getCompletionColor = (percentage) => {
  if (percentage >= 70) return "text-green-600";
  if (percentage >= 40) return "text-yellow-500";
  return "text-red-600";
};

const getCompletionBarBg = (percentage) => {
  if (percentage >= 70) return "bg-green-600";
  if (percentage >= 40) return "bg-yellow-500";
  return "bg-red-600";
};

const CHART_COLORS = [
  "#B366FF",
  "#00FF88",
  "#FFB84D",
  "#FF6B6B",
  "#00D4FF",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export default function PerformancePage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [period, setPeriod] = useState("month");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("chart");
  const [isMobile, setIsMobile] = useState(false);
  const [individualData, setIndividualData] = useState(null);
  const [individualLoading, setIndividualLoading] = useState(true);
  const [individualError, setIndividualError] = useState("");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const canViewAll = user?.role === "Super Admin" || user?.canViewAllTasks;

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await performanceAPI.getLeaderboard({ period });
      setLeaderboard(response.data?.leaderboard || []);
    } catch (error) {
      setError("Failed to fetch performance data");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchIndividualPerformance = useCallback(async () => {
    if (!user?._id) return;
    try {
      setIndividualLoading(true);
      setIndividualError("");
      const response = await teamAPI.getEmployeePerformance(user._id, { period });
      setIndividualData(response.data?.performance || null);
    } catch (error) {
      setIndividualError("Failed to fetch performance data");
      setIndividualData(null);
    } finally {
      setIndividualLoading(false);
    }
  }, [period, user?._id]);

  useEffect(() => {
    if (canViewAll) {
      fetchLeaderboard();
    } else if (user?._id) {
      fetchIndividualPerformance();
    }
  }, [canViewAll, fetchLeaderboard, fetchIndividualPerformance, user?._id]);

  const sortedLeaderboard = useMemo(() =>
    [...leaderboard].sort((a, b) => {
      const nameA = (a?.user?.name || "").toLowerCase();
      const nameB = (b?.user?.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    }),
  [leaderboard]);

  const assignVsCompletedData = useMemo(() =>
    sortedLeaderboard.map((item, index) => ({
      name: item?.user?.name || "Unknown",
      assigned: item?.metrics?.totalTasks || 0,
      completed: item?.metrics?.completedTasks || 0,
      completionRate: item?.metrics?.taskCompletionRate || 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })),
  [sortedLeaderboard]);

  if (!canViewAll) {
    if (individualLoading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="animate-shimmer rounded-lg h-7 w-48 mb-2" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
              <div className="animate-shimmer rounded-lg h-4 w-32" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
            </div>
            <div className="animate-shimmer rounded-lg h-9 w-28" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
          </div>
          <div className="animate-shimmer rounded-2xl h-64" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
        </div>
      );
    }

    if (individualError && !individualData) {
      return (
        <Alert
          className="backdrop-blur-xl rounded-xl p-4 flex items-center gap-3"
          style={{
            backgroundColor: "var(--bg-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <AlertDescription>{individualError}</AlertDescription>
        </Alert>
      );
    }

    if (!individualData) {
      return (
        <Alert
          className="backdrop-blur-xl rounded-xl p-4 flex items-center gap-3"
          style={{
            backgroundColor: "var(--bg-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <AlertDescription>
            Performance data is not available.
          </AlertDescription>
        </Alert>
      );
    }

    const perf = individualData;
    const userInfo = perf.user || {};
    const totalTasks = perf.totalTasks || 0;
    const completed = perf.completedTasks || 0;
    const inProgress = totalTasks - completed;
    const completionRate = perf.taskCompletionRate || 0;
    const dwrRate = perf.dwrApprovalRate;
    const score = userInfo.performanceScore;
    const grade = userInfo.grade;
    const initials = userInfo.name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const getScoreColor = (val) => {
      if (val >= 70) return "var(--color-success)";
      if (val >= 40) return "var(--color-warning)";
      return "var(--color-danger)";
    };

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Performance</h1>
            <p className="text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
              Your performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input-field text-sm"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>

        <Card className="backdrop-blur-xl rounded-2xl shadow-glass-sm">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold"
                style={{
                  background: "color-mix(in srgb, var(--color-purple) 12%, transparent)",
                  color: "var(--color-purple)",
                }}
              >
                {initials}
              </div>
              <div>
                <CardTitle style={{ color: "var(--text-primary)" }}>
                  {userInfo.name || "Unknown"}
                </CardTitle>
                <CardDescription style={{ color: "var(--text-secondary)" }}>
                  {userInfo.role || ""}
                  {userInfo.department ? ` · ${userInfo.department}` : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                style={{
                  backgroundColor: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Tasks</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-purple)" }}>{totalTasks}</p>
              </div>
              <div
                className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                style={{
                  backgroundColor: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Completed</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-success)" }}>{completed}</p>
              </div>
              <div
                className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                style={{
                  backgroundColor: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>In Progress</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-info)" }}>{inProgress}</p>
              </div>
              <div
                className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                style={{
                  backgroundColor: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Completion</p>
                <p className="text-2xl font-bold" style={{ color: getScoreColor(completionRate) }}>{completionRate.toFixed(1)}%</p>
              </div>
              <div
                className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                style={{
                  backgroundColor: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>DWR Approval</p>
                <p className="text-2xl font-bold" style={{ color: getScoreColor(dwrRate) }}>{dwrRate.toFixed(1)}%</p>
              </div>
              {score !== undefined && score !== null && (
                <div
                  className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                  style={{
                    backgroundColor: "var(--bg-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Score</p>
                  <p className="text-2xl font-bold" style={{ color: getScoreColor(score) }}>{score}</p>
                </div>
              )}
              {grade && (
                <div
                  className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                  style={{
                    backgroundColor: "var(--bg-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Grade</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--color-warning)" }}>{grade}</p>
                </div>
              )}
              <div
                className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                style={{
                  backgroundColor: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Avg Completion</p>
                <p className="text-2xl font-bold" style={{ color: "var(--text-secondary)" }}>{(perf.avgCompletionTime || 0).toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="animate-shimmer rounded-lg h-7 w-48 mb-2" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
            <div className="animate-shimmer rounded-lg h-4 w-32" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
          </div>
          <div className="animate-shimmer rounded-lg h-9 w-28" style={{ background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)", backgroundSize: "200% 100%" }} />
        </div>
        <SkeletonChart height="h-72" />
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  const getRankColor = (index) => {
    if (index === 0) return { color: "var(--color-warning)" };
    if (index === 1) return { color: "var(--text-secondary)" };
    if (index === 2) return { color: "var(--color-danger)" };
    return { color: "var(--text-muted)" };
  };

  const getCompletionTextColor = (percentage) => {
    if (percentage >= 70) return { color: "rgb(22 163 74)" };
    if (percentage >= 40) return { color: "rgb(234 179 8)" };
    return { color: "rgb(220 38 38)" };
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div
          className="backdrop-blur-xl p-3 rounded-lg shadow-lg"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-base) 95%, transparent)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="mb-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{label}</p>
          <p className="text-sm" style={{ color: "var(--color-purple)" }}>Assigned: {data?.assigned}</p>
          <p className="text-sm" style={{ color: "var(--color-success)" }}>Completed: {data?.completed}</p>
          <p className={`text-sm font-bold ${getCompletionColor(data?.completionRate)}`}>
            Completion: {data?.completionRate?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Performance</h1>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
            Employee performance metrics and analytics
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field text-sm"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {error && (
        <Alert
          className="backdrop-blur-xl"
          style={{
            backgroundColor: "var(--bg-muted)",
            borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
          }}
        >
          <AlertDescription style={{ color: "var(--color-danger)" }}>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b" style={{ borderBottomColor: "var(--border)" }}>
        <Button
          variant={activeTab === "leaderboard" ? "default" : "ghost"}
          onClick={() => setActiveTab("leaderboard")}
          className="gap-2"
        >
          <Trophy className="h-4 w-4" />
          Leaderboard
        </Button>
        {/* Compare tab hidden - not removed */}
        {/* Trends tab hidden - not removed */}
      </div>

      {/* Leaderboard Tab */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <Card className="backdrop-blur-xl rounded-2xl shadow-glass-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle style={{ color: "var(--text-primary)" }}>Performance Leaderboard</CardTitle>
                  <CardDescription style={{ color: "var(--text-secondary)" }}>
                    Compare task assignments with completions across employees
                  </CardDescription>
                </div>
                <div
                  className="flex gap-1 p-1 rounded-lg w-full sm:w-auto"
                  style={{ backgroundColor: "var(--bg-muted)" }}
                >
                  <Button
                    variant={viewMode === "chart" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("chart")}
                    className="gap-1 flex-1 sm:flex-none"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Chart
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="gap-1 flex-1 sm:flex-none"
                  >
                    <Table2 className="h-4 w-4" />
                    Table
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "chart" ? (
                <div className="space-y-6">
                  <div className="w-full">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={assignVsCompletedData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        barGap={4}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                          angle={-35}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: "13px" }}
                          iconType="rounded"
                        />
                        <Bar
                          dataKey="assigned"
                          name="Assigned"
                          fill="#6366f1"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={50}
                        >
                          {assignVsCompletedData.map((entry, index) => (
                            <Cell key={`assigned-${index}`} fill="#6366f1" />
                          ))}
                        </Bar>
                        <Bar
                          dataKey="completed"
                          name="Completed"
                          fill="#22c55e"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={50}
                        >
                          {assignVsCompletedData.map((entry, index) => (
                            <Cell key={`completed-${index}`} fill="#22c55e" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {assignVsCompletedData.map((item, index) => (
                      <div
                        key={index}
                        className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4"
                        style={{
                          backgroundColor: "var(--bg-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                            {item.name}
                          </p>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Completion</p>
                            <p
                              className={`text-2xl font-bold ${getCompletionColor(item.completionRate)}`}
                            >
                              {item.completionRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right text-xs" style={{ color: "var(--text-secondary)" }}>
                            <p>
                              {item.completed}/{item.assigned}
                            </p>
                          </div>
                        </div>
                          <div className="w-full rounded-full h-2" style={{ backgroundColor: "var(--bg-muted)" }}>
                          <div
                            className={`h-2 rounded-full ${getCompletionBarBg(item.completionRate)}`}
                            style={{ width: `${Math.min(item.completionRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !isMobile ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-head">
                        <th className="text-left py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          #
                        </th>
                        <th className="text-left py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Employee
                        </th>
                        <th className="text-center py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                          Total
                        </th>
                        <th className="text-center py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                          Completed
                        </th>
                        <th className="text-center py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Overdue
                        </th>
                        <th className="text-center py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                          In Progress
                        </th>
                        <th className="text-center py-3.5 px-3 sm:px-4 font-semibold text-[11px] uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                          Completion %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeaderboard.map((item, index) => {
                        const totalTasks = item?.metrics?.totalTasks || 0;
                        const completed = item?.metrics?.completedTasks || 0;
                        const overdue = item?.metrics?.overdueTasks || 0;
                        const inProgress = totalTasks - completed - overdue;
                        const completionRate =
                          item?.metrics?.taskCompletionRate || 0;
                        const color = CHART_COLORS[index % CHART_COLORS.length];
                        const initials = item?.user?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();
                        return (
                          <tr
                            key={item?.user?._id || index}
                            className="transition-colors duration-150"
                            style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-muted)" }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
                          >
                            <td className="py-3.5 px-3 sm:px-4">
                              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 sm:px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold flex-shrink-0"
                                  style={{
                                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                                    color: color,
                                  }}
                                >
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                                    {item?.user?.name || "Unknown"}
                                  </p>
                                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                                    {item?.user?.role || ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 sm:px-4 text-center hidden sm:table-cell">
                              <span className="font-semibold text-sm" style={{ color: "var(--color-purple)" }}>
                                {totalTasks}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 sm:px-4 text-center hidden sm:table-cell">
                              <span className="font-semibold text-sm" style={{ color: "var(--color-success)" }}>
                                {completed}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 sm:px-4 text-center">
                              <span className="font-semibold text-sm" style={{ color: overdue > 0 ? "var(--color-danger)" : "var(--text-muted)" }}>
                                {overdue}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 sm:px-4 text-center hidden md:table-cell">
                              <span className="font-semibold text-sm" style={{ color: "var(--color-info)" }}>
                                {inProgress}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 sm:px-4 hidden sm:table-cell">
                              <div className="flex items-center justify-center gap-2.5">
                                <div className="w-16 rounded-full h-2" style={{ backgroundColor: "var(--bg-muted)" }}>
                                  <div
                                    className={`h-2 rounded-full transition-all ${getCompletionBarBg(completionRate)}`}
                                    style={{ width: `${Math.min(completionRate, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${getCompletionColor(completionRate)}`}>
                                  {completionRate.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {sortedLeaderboard.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-12 text-center"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            No performance data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedLeaderboard.length === 0 ? (
                    <div className="py-12 text-center" style={{ color: "var(--text-secondary)" }}>
                      No performance data available
                    </div>
                  ) : (
                    sortedLeaderboard.map((item, index) => {
                      const totalTasks = item?.metrics?.totalTasks || 0;
                      const completed = item?.metrics?.completedTasks || 0;
                      const overdue = item?.metrics?.overdueTasks || 0;
                      const inProgress = totalTasks - completed - overdue;
                      const completionRate = item?.metrics?.taskCompletionRate || 0;
                      const color = CHART_COLORS[index % CHART_COLORS.length];
                      const initials = item?.user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                      return (
                        <div
                          key={item?.user?._id || index}
                          className="rounded-xl p-3"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium shrink-0 w-5 text-center" style={{ color: "var(--text-muted)" }}>
                              {index + 1}
                            </span>
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                              style={{
                                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                                color: color,
                              }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                                {item?.user?.name || "Unknown"}
                              </p>
                              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                                {item?.user?.role || ""}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-3" style={{}}>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Tasks</p>
                              <p className="text-sm font-semibold" style={{ color: "var(--color-purple)" }}>
                                {completed}<span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/{totalTasks}</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Completion</p>
                              <span className={`text-sm font-bold ${getCompletionColor(completionRate)}`}>
                                {completionRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              Overdue: <strong style={{ color: overdue > 0 ? "var(--color-danger)" : "var(--text-muted)" }}>{overdue}</strong>
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              In Progress: <strong style={{ color: "var(--color-info)" }}>{inProgress}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
