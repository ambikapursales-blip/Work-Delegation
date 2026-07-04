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
import { LoadingSpinner } from "@/components/loading";

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [error, setError] = useState("");
  const [hoveredMember, setHoveredMember] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canViewTeam = ["Admin", "Manager", "HR"].includes(user?.role);

  useEffect(() => {
    if (!canViewTeam) return;
    fetchTeamData();
  }, [canViewTeam, fetchTeamData]);

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      const [membersRes, statsRes] = await Promise.all([
        teamAPI.getMembers(),
        teamAPI.getStats(),
      ]);
      setMembers(membersRes.data?.members || []);
      setStats(statsRes.data?.stats || null);
    } catch (err) {
      setError("Failed to load team data");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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
    }
  };

  const handleViewMember = (member, type) => {
    setSelectedMember(member);
    setActiveTab(type);
    fetchMemberDetails(member._id, type);
  };

  if (!canViewTeam) {
    return (
      <Alert
        className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}
      >
        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-warning)" }} />
        <AlertDescription className="text-sm" style={{ color: "var(--text-secondary)" }}>
          You don&apos;t have permission to view team information.
        </AlertDescription>
      </Alert>
    );
  }

  const getPerformanceColor = (score) => {
    if (score >= 80) return "var(--color-success)";
    if (score >= 60) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getGradeColor = (grade) => {
    const colors = {
      A: {
        backgroundColor: "color-mix(in srgb, var(--color-success) 12%, transparent)",
        color: "var(--color-success)",
        border: "1px solid color-mix(in srgb, var(--color-success) 22%, transparent)",
      },
      B: {
        backgroundColor: "color-mix(in srgb, var(--color-info) 12%, transparent)",
        color: "var(--color-info)",
        border: "1px solid color-mix(in srgb, var(--color-info) 22%, transparent)",
      },
      C: {
        backgroundColor: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
        color: "var(--color-warning)",
        border: "1px solid color-mix(in srgb, var(--color-warning) 22%, transparent)",
      },
      D: {
        backgroundColor: "color-mix(in srgb, var(--color-purple) 12%, transparent)",
        color: "var(--color-purple)",
        border: "1px solid color-mix(in srgb, var(--color-purple) 22%, transparent)",
      },
      F: {
        backgroundColor: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
        color: "var(--color-danger)",
        border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
      },
    };
    return colors[grade] || {
      backgroundColor: "var(--bg-muted)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border)",
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Team Monitoring</h1>
          <p className="mt-1" style={{ color: "var(--text-muted)" }}>
            View and manage your team&apos;s performance
          </p>
        </div>
        <Button onClick={fetchTeamData} variant="outline" className="gap-2" loading={isRefreshing} loadingText="Refreshing...">
          <Activity className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert
          className="backdrop-blur-xl rounded-xl"
          style={{ backgroundColor: "var(--bg-muted)", borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)" }}
        >
          <AlertDescription style={{ color: "var(--color-danger)" }}>{error}</AlertDescription>
        </Alert>
      )}

      {/* Team Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.totalMembers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Active Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: "var(--color-success)" }}>{stats.activeUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.tasks?.totalTasks || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Overdue Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: "var(--color-danger)" }}>{stats.tasks?.overdueTasks || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b" style={{ borderBottomColor: "var(--border)" }}>
        <Button variant={activeTab === "members" ? "default" : "ghost"}
          onClick={() => { setActiveTab("members"); setSelectedMember(null); setMemberData(null); }}
          className="gap-2">
          <Users className="h-4 w-4" />
          Team Members
        </Button>
        {selectedMember && (
          <>
            <Button variant={activeTab === "tasks" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "tasks")} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Tasks
            </Button>
            <Button variant={activeTab === "activity" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "activity")} className="gap-2">
              <Activity className="h-4 w-4" /> Activity
            </Button>
            <Button variant={activeTab === "dwr" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "dwr")} className="gap-2">
              <FileText className="h-4 w-4" /> DWR
            </Button>
            <Button variant={activeTab === "performance" ? "default" : "ghost"}
              onClick={() => handleViewMember(selectedMember, "performance")} className="gap-2">
              <TrendingUp className="h-4 w-4" /> Performance
            </Button>
          </>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>Loading team data...</p>
      ) : activeTab === "members" ? (
        <div className="grid gap-4">
          {members.length === 0 ? (
            <Alert
              className="backdrop-blur-xl rounded-2xl shadow-glass-sm p-4 flex items-center gap-3"
              style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <AlertDescription className="text-sm" style={{ color: "var(--text-muted)" }}>No team members found.</AlertDescription>
            </Alert>
          ) : (
            members.map((member) => (
              <Card key={member._id}
                className="cursor-pointer"
                onClick={() => handleViewMember(member, "tasks")}
                onMouseEnter={() => setHoveredMember(member._id)}
                onMouseLeave={() => setHoveredMember(null)}
                style={hoveredMember === member._id ? {
                  boxShadow: "var(--shadow-card-hover)",
                  transform: "translateY(-2px)",
                } : {}}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{member.name}</h3>
                        <Badge variant="outline" className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>{member.role}</Badge>
                        <Badge variant="secondary" className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-muted)", borderColor: "var(--border)" }}>{member.department}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Employee ID</p>
                          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>{member.employeeId}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Performance Score</p>
                          <p className="font-medium" style={{ color: getPerformanceColor(member.performanceScore) }}>
                            {member.performanceScore || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Grade</p>
                          <Badge style={getGradeColor(member.grade)}>
                            {member.grade || "N/A"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Last Login</p>
                          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
                            {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : "Never"}
                          </p>
                        </div>
                      </div>
                      {member.taskStats && (
                        <div className="mt-3 pt-3 border-t" style={{ borderTopColor: "var(--border)" }}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div><p style={{ color: "var(--text-muted)" }}>Total Tasks</p><p className="font-semibold" style={{ color: "var(--text-secondary)" }}>{member.taskStats.total || 0}</p></div>
                            <div><p style={{ color: "var(--text-muted)" }}>Completed</p><p className="font-semibold" style={{ color: "var(--color-success)" }}>{member.taskStats.completed || 0}</p></div>
                            <div><p style={{ color: "var(--text-muted)" }}>In Progress</p><p className="font-semibold" style={{ color: "var(--color-info)" }}>{member.taskStats.inProgress || 0}</p></div>
                            <div><p style={{ color: "var(--text-muted)" }}>Overdue</p><p className="font-semibold" style={{ color: "var(--color-danger)" }}>{member.taskStats.overdue || 0}</p></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm">View Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : selectedMember ? (
        <div className="space-y-4">
          {/* Member Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{selectedMember.name}</h2>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{selectedMember.role} &bull; {selectedMember.department}</p>
                  </div>
                </div>
                <Button variant="outline"
                  onClick={() => { setActiveTab("members"); setSelectedMember(null); setMemberData(null); }}>
                  Back to Team
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {activeTab === "tasks" && memberData?.tasks && (
            <div className="grid gap-4">
              {memberData.tasks.length === 0 ? (
                <Alert style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}>No tasks found for this member.</Alert>
              ) : (
                memberData.tasks.map((task) => (
                  <Card key={task._id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{task.title}</h3>
                            <Badge style={{
                              backgroundColor: task.status === "Completed"
                                ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                                : task.status === "In Progress"
                                ? "color-mix(in srgb, var(--color-info) 12%, transparent)"
                                : "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                              color: task.status === "Completed"
                                ? "var(--color-success)"
                                : task.status === "In Progress"
                                ? "var(--color-info)"
                                : "var(--color-warning)",
                              border: task.status === "Completed"
                                ? "1px solid color-mix(in srgb, var(--color-success) 22%, transparent)"
                                : task.status === "In Progress"
                                ? "1px solid color-mix(in srgb, var(--color-info) 22%, transparent)"
                                : "1px solid color-mix(in srgb, var(--color-warning) 22%, transparent)",
                            }}>{task.status}</Badge>
                            <Badge style={{
                              backgroundColor: task.priority === "Critical"
                                ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
                                : task.priority === "High"
                                ? "color-mix(in srgb, var(--color-purple) 12%, transparent)"
                                : "var(--bg-muted)",
                              color: task.priority === "Critical"
                                ? "var(--color-danger)"
                                : task.priority === "High"
                                ? "var(--color-purple)"
                                : "var(--text-secondary)",
                              border: task.priority === "Critical"
                                ? "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)"
                                : task.priority === "High"
                                ? "1px solid color-mix(in srgb, var(--color-purple) 22%, transparent)"
                                : "1px solid var(--border)",
                            }}>{task.priority}</Badge>
                          </div>
                          {task.description && <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>{task.description}</p>}
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            <Clock className="h-3 w-3 inline mr-1" style={{ color: "var(--text-muted)" }} />
                            Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString() : "Not set"}
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
                <Alert style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}>No activity found for this member.</Alert>
              ) : (
                memberData.activities.map((activity) => (
                  <Card key={activity._id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Activity className="h-4 w-4 mt-1" style={{ color: "var(--color-info)" }} />
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{activity.description}</p>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            {activity.type} &bull; {new Date(activity.createdAt).toLocaleString()}
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
                <Alert style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}>No DWRs found for this member.</Alert>
              ) : (
                memberData.dwrs.map((dwr) => (
                  <Card key={dwr._id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{new Date(dwr.date).toLocaleDateString()}</h3>
                            <Badge style={{
                              backgroundColor: dwr.reviewStatus === "Approved"
                                ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                                : dwr.reviewStatus === "Rejected"
                                ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
                                : "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                              color: dwr.reviewStatus === "Approved"
                                ? "var(--color-success)"
                                : dwr.reviewStatus === "Rejected"
                                ? "var(--color-danger)"
                                : "var(--color-warning)",
                              border: dwr.reviewStatus === "Approved"
                                ? "1px solid color-mix(in srgb, var(--color-success) 22%, transparent)"
                                : dwr.reviewStatus === "Rejected"
                                ? "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)"
                                : "1px solid color-mix(in srgb, var(--color-warning) 22%, transparent)",
                            }}>{dwr.reviewStatus}</Badge>
                            {dwr.isLate && <Badge style={{
                              backgroundColor: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
                              color: "var(--color-warning)",
                              border: "1px solid color-mix(in srgb, var(--color-warning) 22%, transparent)",
                            }}>Late</Badge>}
                          </div>
                          {dwr.workSummary && <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>{dwr.workSummary}</p>}
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Hours: {dwr.totalHoursWorked || 0}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "performance" && memberData?.performance && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription style={{ color: "var(--text-muted)" }}>{memberData.performance.period} period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Performance Score</p>
                    <p className="text-2xl font-bold" style={{ color: getPerformanceColor(memberData.performance.user.performanceScore) }}>
                      {memberData.performance.user.performanceScore || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Task Completion Rate</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--color-info)" }}>
                      {memberData.performance.taskCompletionRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>DWR Approval Rate</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--color-success)" }}>
                      {memberData.performance.dwrApprovalRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Avg Completion Time</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--color-purple)" }}>
                      {memberData.performance.avgCompletionTime?.toFixed(1) || 0}h
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t" style={{ borderTopColor: "var(--border)" }}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Total Tasks</p>
                      <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>{memberData.performance.totalTasks || 0}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Completed Tasks</p>
                      <p className="font-semibold" style={{ color: "var(--color-success)" }}>{memberData.performance.completedTasks || 0}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Total DWRs</p>
                      <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>{memberData.performance.totalDWRs || 0}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>Approved DWRs</p>
                      <p className="font-semibold" style={{ color: "var(--color-success)" }}>{memberData.performance.approvedDWRs || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Alert style={{ backgroundColor: "var(--bg-muted)", borderColor: "var(--border)" }}>Select a team member to view details.</Alert>
      )}
    </div>
  );
}
