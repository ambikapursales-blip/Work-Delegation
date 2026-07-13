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
import { performanceAPI } from "@/lib/api";
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

const gradeColors = {
  "A+": "#00FF88",
  A: "#84cc16",
  "B+": "#FFB84D",
  B: "#f97316",
  C: "#FF6B6B",
  D: "#B366FF",
  F: "#64748b",
};

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

  const canView = user?.role === "Super Admin";

  const fetchData = useCallback(async () => {
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

  useEffect(() => {
    if (!canView) return;
    fetchData();
  }, [canView, fetchData]);

  const assignVsCompletedData = useMemo(() =>
    leaderboard.map((item, index) => ({
      name: item?.user?.name || "Unknown",
      assigned: item?.metrics?.totalTasks || 0,
      completed: item?.metrics?.completedTasks || 0,
      completionRate: item?.metrics?.taskCompletionRate || 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })),
  [leaderboard]);

  if (!canView) {
    return (
      <Alert
        className="backdrop-blur-xl rounded-xl p-4 flex items-center gap-3"
        style={{
          backgroundColor: "var(--bg-muted)",
          border: "1px solid var(--border)",
        }}
      >
        <AlertDescription>
          You don&apos;t have permission to view performance data.
        </AlertDescription>
      </Alert>
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

  const getPerformanceColor = (score) => {
    if (score >= 80) return { color: "var(--color-success)" };
    if (score >= 60) return { color: "var(--color-warning)" };
    return { color: "var(--color-danger)" };
  };

  const getGradeColor = (grade) => {
    const map = {
      "A+": "var(--color-success)",
      A: "var(--color-success)",
      "B+": "var(--color-info)",
      B: "var(--color-info)",
      C: "var(--color-warning)",
      D: "var(--color-danger)",
      F: "var(--color-danger)",
    };
    const color = map[grade];
    if (color) {
      return {
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      };
    }
    return {
      backgroundColor: "var(--bg-muted)",
      color: "var(--text-secondary)",
      borderColor: "var(--border)",
    };
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: "var(--text-primary)" }}>Performance Leaderboard</CardTitle>
                  <CardDescription style={{ color: "var(--text-secondary)" }}>
                    Compare task assignments with completions across employees
                  </CardDescription>
                </div>
                <div
                  className="flex gap-1 p-1 rounded-lg"
                  style={{ backgroundColor: "var(--bg-muted)" }}
                >
                  <Button
                    variant={viewMode === "chart" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("chart")}
                    className="gap-1"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Chart
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="gap-1"
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
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-head">
                        <th className="text-left py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          #
                        </th>
                        <th className="text-left py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Employee
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Total
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Completed
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Overdue
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          In Progress
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          DWR
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Completion %
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Score
                        </th>
                        <th className="text-center py-3.5 px-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Grade
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((item, index) => {
                        const totalTasks = item?.metrics?.totalTasks || 0;
                        const completed = item?.metrics?.completedTasks || 0;
                        const overdue = item?.metrics?.overdueTasks || 0;
                        const inProgress = totalTasks - completed - overdue;
                        const completionRate =
                          item?.metrics?.taskCompletionRate || 0;
                        const totalDWRs = item?.metrics?.totalDWRs || 0;
                        const approvedDWRs = item?.metrics?.approvedDWRs || 0;
                        const score = item?.user?.performanceScore || 0;
                        const grade = item?.user?.grade || "";
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
                            <td className="py-3.5 px-4">
                              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
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
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-sm" style={{ color: "var(--color-purple)" }}>
                                {totalTasks}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-sm" style={{ color: "var(--color-success)" }}>
                                {completed}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-sm" style={{ color: overdue > 0 ? "var(--color-danger)" : "var(--text-muted)" }}>
                                {overdue}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-sm" style={{ color: "var(--color-info)" }}>
                                {inProgress}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="font-semibold text-sm" style={{ color: "var(--color-info)" }}>
                                  {approvedDWRs}
                                </span>
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  / {totalDWRs}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
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
                            <td className="py-3.5 px-4 text-center">
                              <span className="text-sm font-semibold" style={{ color: score > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                                {score > 0 ? score : "-"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {grade ? (
                                <span
                                  className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide"
                                  style={getGradeColor(grade)}
                                >
                                  {grade}
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
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
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
