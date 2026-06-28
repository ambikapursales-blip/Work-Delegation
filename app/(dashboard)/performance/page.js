"use client";

import { useState, useEffect, useMemo } from "react";
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
      <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
        <AlertDescription>
          You don&apos;t have permission to view performance data.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) return <Loading />;

  const getRankColor = (index) => {
    if (index === 0) return "text-[#FFB84D]";
    if (index === 1) return "text-white/50";
    if (index === 2) return "text-[#FF6B6B]";
    return "text-white/40";
  };

  const getPerformanceColor = (score) => {
    if (score >= 80) return "text-[#00FF88]";
    if (score >= 60) return "text-[#FFB84D]";
    return "text-[#FF6B6B]";
  };

  const getGradeColor = (grade) => {
    const colors = {
      "A+": "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
      A: "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
      "B+": "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
      B: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
      C: "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
      D: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
      F: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
    };
    return colors[grade] || "bg-white/[0.08] text-white/60 border-white/[0.1]";
  };

  const getCompletionBarColor = (percentage) => {
    if (percentage >= 80) return "bg-[#00FF88]";
    if (percentage >= 60) return "bg-[#FFB84D]";
    if (percentage >= 40) return "bg-[#FF6B6B]";
    return "bg-red-500";
  };

  const getCompletionTextColor = (percentage) => {
    if (percentage >= 80) return "text-[#00FF88]";
    if (percentage >= 60) return "text-[#FFB84D]";
    if (percentage >= 40) return "text-[#FF6B6B]";
    return "text-red-500";
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-[#0B1220]/95 backdrop-blur-xl p-3 rounded-lg shadow-lg border border-white/[0.06]">
          <p className="font-semibold text-white/85 mb-1">{label}</p>
          <p className="text-sm text-[#B366FF]">Assigned: {data?.assigned}</p>
          <p className="text-sm text-[#00FF88]">Completed: {data?.completed}</p>
          <p
            className={`text-sm font-bold ${getCompletionTextColor(data?.completionRate)}`}
          >
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
          <h1 className="text-3xl font-bold tracking-tight text-white/85">Performance</h1>
          <p className="text-white/50">
            Employee performance metrics and analytics
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-white/[0.1] rounded-md text-sm bg-white/[0.05] text-white"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {error && (
        <Alert className="bg-white/[0.04] backdrop-blur-xl border-red-500/30">
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/[0.06]">
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
          <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white/85">Performance Leaderboard</CardTitle>
                  <CardDescription className="text-white/50">
                    Compare task assignments with completions across employees
                  </CardDescription>
                </div>
                <div className="flex gap-1 bg-white/[0.08] p-1 rounded-lg">
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
                        <Recharts.CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <Recharts.XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                          angle={-35}
                          textAnchor="end"
                          height={80}
                        />
                        <Recharts.YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }} />
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
                        className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 shadow-glass-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <p className="font-semibold text-sm text-white/85 truncate">
                            {item.name}
                          </p>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <p className="text-xs text-white/50">Completion</p>
                            <p
                              className={`text-2xl font-bold ${getCompletionTextColor(item.completionRate)}`}
                            >
                              {item.completionRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right text-xs text-white/50">
                            <p>
                              {item.completed}/{item.assigned}
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-white/[0.08] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getCompletionBarColor(item.completionRate)}`}
                            style={{
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
                      <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                        <th className="text-left py-3 px-4 font-semibold text-white/40">
                          #
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-white/40">
                          Employee
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-white/40">
                          Assigned
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-white/40">
                          Completed
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-white/40">
                          Pending
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-white/40">
                          Completion %
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-white/40">
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
                            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-3 px-4">
                              <span
                                className={`font-bold ${getRankColor(index)}`}
                              >
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={
                                    item?.user?.avatar ||
                                    (item?.user?.name === "Test User"
                                      ? "https://media.licdn.com/dms/image/v2/D4D35AQFg1T2O6uFFqQ/profile-framedphoto-shrink_200_200/B4DZ2VAojkGcAY-/0/1776321464831?e=1776927600&v=beta&t=ScJJtGxGE9WzGYJtjXpkcvYj-RECD_KumfnxzblzKZk"
                                      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${item?.user?.name || "user"}`)
                                  }
                                  alt={item?.user?.name || "User"}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-white/[0.1]"
                                />
                                <div>
                                  <p className="font-medium">
                                    {item?.user?.name || "Unknown"}
                                  </p>
                                  <p className="text-xs text-white/50">
                                    {item?.user?.department || "N/A"} •{" "}
                                    {item?.user?.role || "N/A"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold text-[#B366FF]">
                                {assigned}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold text-[#00FF88]">
                                {completed}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold text-[#FFB84D]">
                                {pending}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`font-bold ${getCompletionTextColor(completionRate)}`}
                              >
                                {completionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-white/[0.08] rounded-full h-2.5">
                                  <div
                                    className={`h-2.5 rounded-full ${getCompletionBarColor(completionRate)}`}
                                    style={{
                                      width: `${Math.min(completionRate, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-white/50">
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
                            className="py-8 text-center text-white/50"
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
