"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  FileText,
  TrendingUp,
  User,
  Calendar,
} from "lucide-react";
import { teamAPI } from "@/lib/api";

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [error, setError] = useState("");

  const canViewTeam = ["Admin", "Manager", "HR"].includes(user?.role);

  useEffect(() => {
    if (!canViewTeam) return;
    fetchTeamData();
  }, [canViewTeam, fetchTeamData]);

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, statsRes] = await Promise.all([
        teamAPI.getMembers(),
        teamAPI.getStats(),
      ]);
      setMembers(membersRes.data?.members || []);
      setStats(statsRes.data?.stats || null);
    } catch (err) {
      setError("Failed to load team data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMemberDetails = async (memberId, type) => {
    try {
      let response;
      switch (type) {
        case "tasks":
          response = await teamAPI.getEmployeeTasks(memberId);
          break;
        case "activity":
          response = await teamAPI.getEmployeeActivity(memberId);
          break;
        case "dwr":
          response = await teamAPI.getEmployeeDWRs(memberId);
          break;
        case "performance":
          response = await teamAPI.getEmployeePerformance(memberId);
          break;
      }
      setMemberData(response.data);
    } catch (err) {
      setError(`Failed to load ${type}`);
      console.error(err);
    }
  };

  const handleViewMember = (member, type) => {
    setSelectedMember(member);
    setActiveTab(type);
    fetchMemberDetails(member._id, type);
  };

  if (!canViewTeam) {
    return (
      <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm p-4 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-[#FFB84D] shrink-0" />
        <AlertDescription className="text-sm text-white/60">
          You don&apos;t have permission to view team information.
        </AlertDescription>
      </Alert>
    );
  }

  const getPerformanceColor = (score) => {
    if (score >= 80) return "text-[#00FF88]";
    if (score >= 60) return "text-[#FFB84D]";
    return "text-[#FF6B6B]";
  };

  const getGradeColor = (grade) => {
    const colors = {
      A: "bg-[#00FF88]/15 text-[#00FF88] ring-1 ring-[#00FF88]/25",
      B: "bg-[#00D4FF]/15 text-[#00D4FF] ring-1 ring-[#00D4FF]/25",
      C: "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25",
      D: "bg-[#B366FF]/15 text-[#B366FF] ring-1 ring-[#B366FF]/25",
      F: "bg-[#FF6B6B]/15 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/25",
    };
    return colors[grade] || "bg-white/[0.08] text-white/60 ring-1 ring-white/[0.1]";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white/85">Team Monitoring</h1>
          <p className="text-white/50 mt-1">
            View and manage your team&apos;s performance
          </p>
        </div>
        <Button onClick={fetchTeamData} variant="outline" className="gap-2">
          <Activity className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert className="bg-white/[0.04] backdrop-blur-xl border border-red-500/30 rounded-xl">
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      {/* Team Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Total Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white/85">{stats.totalMembers}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Active Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#00FF88]">
                {stats.activeUsers}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white/85">{stats.tasks?.totalTasks || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Overdue Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#FF6B6B]">
                {stats.tasks?.overdueTasks || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/[0.06]">
        <Button
          variant={activeTab === "members" ? "default" : "ghost"}
          onClick={() => {
            setActiveTab("members");
            setSelectedMember(null);
            setMemberData(null);
          }}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Team Members
        </Button>
        {selectedMember && (
          <>
            <Button
              variant={activeTab === "tasks" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "tasks")}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Tasks
            </Button>
            <Button
              variant={activeTab === "activity" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "activity")}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              Activity
            </Button>
            <Button
              variant={activeTab === "dwr" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "dwr")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              DWR
            </Button>
            <Button
              variant={activeTab === "performance" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "performance")}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Performance
            </Button>
          </>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <p className="text-center text-white/50 py-8">
          Loading team data...
        </p>
      ) : activeTab === "members" ? (
        <div className="grid gap-4">
          {members.length === 0 ? (
            <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm p-4 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-white/40 shrink-0" />
              <AlertDescription className="text-sm text-white/50">No team members found.</AlertDescription>
            </Alert>
          ) : (
            members.map((member) => (
              <Card
                key={member._id}
                className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm hover:shadow-glass-md transition-all duration-200 cursor-pointer"
                onClick={() => handleViewMember(member, "tasks")}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-white/40" />
                        <h3 className="text-lg font-semibold text-white/85">{member.name}</h3>
                        <Badge variant="outline" className="bg-white/[0.08] text-white/60 text-xs font-medium px-2.5 py-1 rounded-lg border border-white/[0.1]">{member.role}</Badge>
                        <Badge variant="secondary" className="bg-white/[0.05] text-white/50 text-xs font-medium px-2.5 py-1 rounded-lg border border-white/[0.06]">{member.department}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-white/50">Employee ID</p>
                          <p className="font-medium text-white/70">{member.employeeId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Performance Score</p>
                          <p className={`font-medium ${getPerformanceColor(member.performanceScore)}`}>
                            {member.performanceScore || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Grade</p>
                          <Badge className={getGradeColor(member.grade)}>
                            {member.grade || "N/A"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Last Login</p>
                          <p className="font-medium text-white/70">
                            {member.lastLogin
                              ? new Date(member.lastLogin).toLocaleDateString()
                              : "Never"}
                          </p>
                        </div>
                      </div>
                      {member.taskStats && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-white/50">Total Tasks</p>
                              <p className="font-semibold text-white/70">{member.taskStats.total || 0}</p>
                            </div>
                            <div>
                              <p className="text-white/50">Completed</p>
                              <p className="font-semibold text-[#00FF88]">
                                {member.taskStats.completed || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">In Progress</p>
                              <p className="font-semibold text-[#00D4FF]">
                                {member.taskStats.inProgress || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">Overdue</p>
                              <p className="font-semibold text-[#FF6B6B]">
                                {member.taskStats.overdue || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : selectedMember ? (
        <div className="space-y-4">
          {/* Member Header */}
          <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-6 w-6 text-white/40" />
                  <div>
                    <h2 className="text-xl font-semibold text-white/85">{selectedMember.name}</h2>
                    <p className="text-sm text-white/50">
                      {selectedMember.role} • {selectedMember.department}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab("members");
                    setSelectedMember(null);
                    setMemberData(null);
                  }}
                >
                  Back to Team
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {activeTab === "tasks" && memberData?.tasks && (
            <div className="grid gap-4">
              {memberData.tasks.length === 0 ? (
                <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm p-4 flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-white/40 shrink-0" />
                  <AlertDescription className="text-sm text-white/50">No tasks found for this member.</AlertDescription>
                </Alert>
              ) : (
                memberData.tasks.map((task) => (
                  <Card key={task._id} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white/85">{task.title}</h3>
                            <Badge
                              className={
                                task.status === "Completed"
                                  ? "bg-[#00FF88]/15 text-[#00FF88] ring-1 ring-[#00FF88]/25"
                                  : task.status === "In Progress"
                                  ? "bg-[#00D4FF]/15 text-[#00D4FF] ring-1 ring-[#00D4FF]/25"
                                  : "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25"
                              }
                            >
                              {task.status}
                            </Badge>
                            <Badge
                              className={
                                task.priority === "Critical"
                                  ? "bg-[#FF6B6B]/15 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/25"
                                  : task.priority === "High"
                                  ? "bg-[#B366FF]/15 text-[#B366FF] ring-1 ring-[#B366FF]/25"
                                  : "bg-white/[0.08] text-white/60 ring-1 ring-white/[0.1]"
                              }
                            >
                              {task.priority}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-white/50 mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="text-xs text-white/50">
                            <Clock className="h-3 w-3 inline mr-1 text-white/40" />
                            Deadline:{" "}
                            {task.deadline
                              ? new Date(task.deadline).toLocaleDateString()
                              : "Not set"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "activity" && memberData?.activities && (
            <div className="grid gap-4">
              {memberData.activities.length === 0 ? (
                <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm p-4 flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-white/40 shrink-0" />
                  <AlertDescription className="text-sm text-white/50">No activity found for this member.</AlertDescription>
                </Alert>
              ) : (
                memberData.activities.map((activity) => (
                  <Card key={activity._id} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Activity className="h-4 w-4 text-[#00D4FF] mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white/85">{activity.description}</p>
                          <p className="text-xs text-white/50 mt-1">
                            {activity.type} •{" "}
                            {new Date(activity.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "dwr" && memberData?.dwrs && (
            <div className="grid gap-4">
              {memberData.dwrs.length === 0 ? (
                <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm p-4 flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-white/40 shrink-0" />
                  <AlertDescription className="text-sm text-white/50">No DWRs found for this member.</AlertDescription>
                </Alert>
              ) : (
                memberData.dwrs.map((dwr) => (
                  <Card key={dwr._id} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-white/40" />
                            <h3 className="font-semibold text-white/85">
                              {new Date(dwr.date).toLocaleDateString()}
                            </h3>
                            <Badge
                              className={
                                dwr.reviewStatus === "Approved"
                                  ? "bg-[#00FF88]/15 text-[#00FF88] ring-1 ring-[#00FF88]/25"
                                  : dwr.reviewStatus === "Rejected"
                                  ? "bg-[#FF6B6B]/15 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/25"
                                  : "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25"
                              }
                            >
                              {dwr.reviewStatus}
                            </Badge>
                            {dwr.isLate && (
                              <Badge className="bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                                Late
                              </Badge>
                            )}
                          </div>
                          {dwr.workSummary && (
                            <p className="text-sm text-white/50 mb-2">
                              {dwr.workSummary}
                            </p>
                          )}
                          <div className="text-xs text-white/50">
                            Hours: {dwr.totalHoursWorked || 0}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "performance" && memberData?.performance && (
            <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
              <CardHeader>
                <CardTitle className="text-white/85">Performance Summary</CardTitle>
                <CardDescription className="text-white/50">
                  {memberData.performance.period} period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-white/50">Performance Score</p>
                    <p className={`text-2xl font-bold ${getPerformanceColor(memberData.performance.user.performanceScore)}`}>
                      {memberData.performance.user.performanceScore || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Task Completion Rate</p>
                    <p className="text-2xl font-bold text-[#00D4FF]">
                      {memberData.performance.taskCompletionRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">DWR Approval Rate</p>
                    <p className="text-2xl font-bold text-[#00FF88]">
                      {memberData.performance.dwrApprovalRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Avg Completion Time</p>
                    <p className="text-2xl font-bold text-[#B366FF]">
                      {memberData.performance.avgCompletionTime?.toFixed(1) || 0}h
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/50">Total Tasks</p>
                      <p className="font-semibold text-white/70">{memberData.performance.totalTasks || 0}</p>
                    </div>
                    <div>
                      <p className="text-white/50">Completed Tasks</p>
                      <p className="font-semibold text-[#00FF88]">{memberData.performance.completedTasks || 0}</p>
                    </div>
                    <div>
                      <p className="text-white/50">Total DWRs</p>
                      <p className="font-semibold text-white/70">{memberData.performance.totalDWRs || 0}</p>
                    </div>
                    <div>
                      <p className="text-white/50">Approved DWRs</p>
                      <p className="font-semibold text-[#00FF88]">{memberData.performance.approvedDWRs || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Alert className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm p-4 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-white/40 shrink-0" />
          <AlertDescription className="text-sm text-white/50">Select a team member to view details.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
