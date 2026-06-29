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
import { Loading } from "@/components/loading";
import dynamic from "next/dynamic";
import { Trophy, BarChart3, Table2 } from "lucide-react";

const Recharts = dynamic(() => import("recharts"), { ssr: false });

const gradeColors = {
  "A+": "#00FF88",
  A: "#84cc16",
  "B+": "#FFB84D",
  B: "#f97316",
  C: "#FF6B6B",
  D: "#B366FF",
  F: "#64748b",
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

  const canView = ["Admin", "Manager", "HR"].includes(user?.role);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await performanceAPI.getLeaderboard({ period });
      setLeaderboard(response.data?.leaderboard || []);
    } catch (error) {
      setError("Failed to fetch performance data");
      console.error(error);
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

  if (loading) return <Loading />;

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

  const getCompletionBarColor = (percentage) => {
    if (percentage >= 80) return { backgroundColor: "var(--color-success)" };
    if (percentage >= 60) return { backgroundColor: "var(--color-warning)" };
    if (percentage >= 40) return { backgroundColor: "var(--color-danger)" };
    return { backgroundColor: "var(--color-danger)" };
  };

  const getCompletionTextColor = (percentage) => {
    if (percentage >= 80) return { color: "var(--color-success)" };
    if (percentage >= 60) return { color: "var(--color-warning)" };
    if (percentage >= 40) return { color: "var(--color-danger)" };
    return { color: "var(--color-danger)" };
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
          <p className="text-sm font-bold" style={getCompletionTextColor(data?.completionRate)}>
            Completion: {data?.completionRate?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Performance</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Employee performance metrics and analytics
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field"
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
                    <Recharts.ResponsiveContainer width="100%" height={400}>
                      <Recharts.BarChart
                        data={assignVsCompletedData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        barGap={4}
                      >
                        <Recharts.CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <Recharts.XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                          angle={-35}
                          textAnchor="end"
                          height={80}
                        />
                        <Recharts.YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                        <Recharts.Tooltip content={<CustomTooltip />} />
                        <Recharts.Legend
                          wrapperStyle={{ fontSize: "13px" }}
                          iconType="rounded"
                        />
                        <Recharts.Bar
                          dataKey="assigned"
                          name="Assigned"
                          fill="#6366f1"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={50}
                        >
                          {assignVsCompletedData.map((entry, index) => (
                            <Recharts.Cell key={`assigned-${index}`} fill="#6366f1" />
                          ))}
                        </Recharts.Bar>
                        <Recharts.Bar
                          dataKey="completed"
                          name="Completed"
                          fill="#22c55e"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={50}
                        >
                          {assignVsCompletedData.map((entry, index) => (
                            <Recharts.Cell key={`completed-${index}`} fill="#22c55e" />
                          ))}
                        </Recharts.Bar>
                      </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
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
                              className="text-2xl font-bold"
                              style={getCompletionTextColor(item.completionRate)}
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
                            className="h-2 rounded-full"
                            style={{
                              ...getCompletionBarColor(item.completionRate),
                              width: `${Math.min(item.completionRate, 100)}%`,
                            }}
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
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          #
                        </th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          Employee
                        </th>
                        <th className="text-center py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          Assigned
                        </th>
                        <th className="text-center py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          Completed
                        </th>
                        <th className="text-center py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          Pending
                        </th>
                        <th className="text-center py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          Completion %
                        </th>
                        <th className="text-left py-3 px-4 font-semibold" style={{ color: "var(--text-muted)" }}>
                          Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((item, index) => {
                        const assigned = item?.metrics?.totalTasks || 0;
                        const completed = item?.metrics?.completedTasks || 0;
                        const pending = assigned - completed;
                        const completionRate =
                          item?.metrics?.taskCompletionRate || 0;
                        const color = CHART_COLORS[index % CHART_COLORS.length];
                        return (
                          <tr
                            key={item?.user?._id || index}
                            className="table-row-hover"
                          >
                            <td className="py-3 px-4">
                              <span className="font-bold" style={getRankColor(index)}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={
                                    item?.user?.avatar ||
                                    (item?.user?.name === "Test User"
                                      ? "https://media.licdn.com/dms/image/v2/D4D35AQFg1T2O6uFFqQ/profile-framedphoto-shrink_200_200/B4DZ2VAojkGcAY-/0/1776321464831?e=1776927600&v=beta&t=ScJJtGxGE9WzGYJtjXpkcvYj-RECD_KumfnxzblzKZk"
                                      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${item?.user?.name || "user"}`)
                                  }
                                  alt={item?.user?.name || "User"}
                                  className="w-10 h-10 rounded-full object-cover border-2"
                                  style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}
                                />
                                <div>
                                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                                    {item?.user?.name || "Unknown"}
                                  </p>
                                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                    {item?.user?.department || "N/A"} •{" "}
                                    {item?.user?.role || "N/A"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold" style={{ color: "var(--color-purple)" }}>
                                {assigned}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold" style={{ color: "var(--color-success)" }}>
                                {completed}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold" style={{ color: "var(--color-warning)" }}>
                                {pending}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-bold" style={getCompletionTextColor(completionRate)}>
                                {completionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 rounded-full h-2.5" style={{ backgroundColor: "var(--bg-muted)" }}>
                                  <div
                                    className="h-2.5 rounded-full"
                                    style={{
                                      ...getCompletionBarColor(completionRate),
                                      width: `${Math.min(completionRate, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  {completionRate.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center"
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
