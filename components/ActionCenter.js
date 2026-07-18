"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { actionCenterAPI } from "@/lib/api";
import {
  Bell,
  CheckCircle2,
  MessageSquare,
  CalendarClock,
  Clock,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

const STATUS_STYLE = {
  Critical: { bg: "color-mix(in srgb, var(--color-danger) 15%, transparent)", clr: "var(--color-danger)" },
  High: { bg: "color-mix(in srgb, var(--color-warning) 15%, transparent)", clr: "var(--color-warning)" },
  Medium: { bg: "color-mix(in srgb, var(--color-info) 12%, transparent)", clr: "var(--color-info)" },
  Low: { bg: "color-mix(in srgb, var(--color-success) 12%, transparent)", clr: "var(--color-success)" },
};

function badgeStyle(clr) {
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.3px",
    background: `color-mix(in srgb, ${clr} 12%, transparent)`,
    color: clr,
  };
}

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const FILTERS = [
  { key: "all", label: "All Activities" },
  { key: "pending", label: "Pending Approval" },
  { key: "completed", label: "Completed" },
  { key: "comments", label: "Comments" },
  { key: "deadline", label: "Deadline Requests" },
];

function SkeletonCard() {
  return (
    <div className="animate-pulse" style={{ background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border)", padding: "20px", marginBottom: "12px" }}>
      <div style={{ height: "14px", background: "var(--bg-muted)", borderRadius: "6px", width: "60%", marginBottom: "12px" }} />
      <div style={{ height: "12px", background: "var(--bg-muted)", borderRadius: "6px", width: "40%", marginBottom: "8px" }} />
      <div style={{ height: "12px", background: "var(--bg-muted)", borderRadius: "6px", width: "50%" }} />
    </div>
  );
}

export default function ActionCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [alert, setAlert] = useState(null);
  const [processing, setProcessing] = useState({});
  const filterRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setActiveFilter("all");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 3500);
    return () => clearTimeout(t);
  }, [alert]);

  const fetchUsers = useCallback(async () => {
    if (user?.role !== "Super Admin") return;
    try {
      setLoadingUsers(true);
      const { usersAPI } = await import("@/lib/api");
      const res = await usersAPI.getAll({ isActive: true });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("[ActionCenter] fetch users error:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [user?.role]);

  const canViewAll = user?.role === "Super Admin" || user?.canViewAllTasks;

  const fetchData = useCallback(async () => {
    try {
      const params = { filter: activeFilter };
      if (selectedUser && canViewAll) {
        params.userId = selectedUser;
      }
      const res = await actionCenterAPI.getItems(params);
      setItems(res.data.items || []);
      setActivities(res.data.activities || []);
      setPendingCount(res.data.pendingCount || 0);
    } catch (err) {
      console.error("[ActionCenter] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, selectedUser, canViewAll]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleReview = async (notificationId) => {
    setProcessing((p) => ({ ...p, [notificationId]: "reviewing" }));
    try {
      const { notificationsAPI } = await import("@/lib/api");
      await notificationsAPI.markAsRead(notificationId);
      setItems((prev) => prev.filter((i) => i._id !== notificationId));
      setAlert({ type: "success", message: "Marked as reviewed" });
      setPendingCount((c) => Math.max(0, c - 1));
    } catch {
      setAlert({ type: "error", message: "Failed to mark as reviewed" });
    } finally {
      setProcessing((p) => {
        const next = { ...p };
        delete next[notificationId];
        return next;
      });
    }
  };

  const handleExtensionResponse = async (taskId, requestId, action, extId) => {
    setProcessing((p) => ({ ...p, [extId]: action }));
    try {
      await actionCenterAPI.respondExtension({ taskId, requestId, action });
      setItems((prev) => prev.filter((i) => i._id !== extId));
      setAlert({ type: "success", message: `Request ${action === "approved" ? "approved" : "rejected"} successfully` });
      setPendingCount((c) => Math.max(0, c - 1));
    } catch {
      setAlert({ type: "error", message: `Failed to ${action} request` });
    } finally {
      setProcessing((p) => {
        const next = { ...p };
        delete next[extId];
        return next;
      });
    }
  };

  const filteredItems = activeFilter === "all"
    ? items
    : activeFilter === "pending"
      ? items.filter((i) => i.type === "task_completed" || i.type === "extension_request")
      : activeFilter === "completed"
        ? items.filter((i) => i.type === "task_completed")
        : activeFilter === "comments"
          ? items.filter((i) => i.type === "comment")
          : activeFilter === "deadline"
            ? items.filter((i) => i.type === "extension_request")
            : items;

  const canManage = user && (user.role === "Super Admin" || user.canAssignTasks);

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                Review and respond to task activities
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={fetchData}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              {pendingCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: "var(--color-danger)", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap" }}>
                  <Bell className="w-4 h-4" />
                  {pendingCount} pending
                </div>
              )}
            </div>
          </div>
        </div>

        {alert && (
          <div style={{
            padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: 500,
            background: alert.type === "success" ? "color-mix(in srgb, var(--color-success) 12%, transparent)" : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
            color: alert.type === "success" ? "var(--color-success)" : "var(--color-danger)",
            border: `1px solid ${alert.type === "success" ? "color-mix(in srgb, var(--color-success) 20%, transparent)" : "color-mix(in srgb, var(--color-danger) 20%, transparent)"}`,
          }}>
            {alert.message}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }} ref={filterRef}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: "8px 16px", borderRadius: "999px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", transition: "all 0.15s",
                background: activeFilter === f.key ? "var(--color-primary)" : "var(--bg-surface)",
                color: activeFilter === f.key ? "#FFF" : "var(--text-secondary)",
                border: activeFilter === f.key ? "none" : "1px solid var(--border)",
              }}
            >
              {f.label}
            </button>
          ))}
          {canViewAll && (
            <>
              <div style={{ width: "1px", height: "24px", background: "var(--border)", margin: "0 4px" }} />
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                disabled={loadingUsers}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  cursor: "pointer",
                  minWidth: "150px",
                }}
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {loading ? (
          <div>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {activeFilter !== "all" && activeFilter !== "pending" && (
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  Activity Timeline
                </h2>
                <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: "16px" }}>
                  {activities.length > 0 ? activities.map((act, idx) => (
                    <div key={act._id || idx} style={{ position: "relative", paddingBottom: "16px" }}>
                      <div style={{ position: "absolute", left: "-22px", top: "4px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--color-primary)", border: "2px solid var(--bg-base)" }} />
                      <p style={{ fontSize: "13px", color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>
                        {act.description || "Activity"}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                        {timeAgo(act.createdAt)} — {act.user?.name || "Unknown"}
                      </p>
                    </div>
                  )) : (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No activities in this period</p>
                  )}
                </div>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                <CheckCircle2 className="w-12 h-12" style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "4px" }}>All caught up!</p>
                <p style={{ fontSize: "13px" }}>No pending items need your attention.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredItems.map((item) => (
                  <div key={item._id} style={{
                    background: "var(--bg-surface)",
                    borderRadius: "12px",
                    border: item.type === "extension_request" ? "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)" : "1px solid var(--border)",
                    padding: "20px",
                    transition: "box-shadow 0.15s",
                  }}>
                    {item.type === "task_completed" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "color-mix(in srgb, var(--color-success) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <CheckCircle2 className="w-5 h-5" style={{ color: "var(--color-success)" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>
                              Task completed: <span style={{ color: "var(--color-primary)" }}>{item.taskTitle}</span>
                            </p>
                            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                              Completed by <strong>{item.actor?.name || "Unknown"}</strong> · {fmtDateTime(item.completedAt)}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                          <span style={badgeStyle(STATUS_STYLE[item.priority]?.clr || "#6B6558")}>{item.priority}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock className="w-3.5 h-3.5" />
                            Deadline: {fmtDate(item.deadline)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Link
                            href={`/tasks/${item.taskId}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, background: "var(--bg-muted)", color: "var(--text-primary)", textDecoration: "none", border: "1px solid var(--border)" }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Task
                          </Link>
                          {item.notificationId && (
                            <button
                              onClick={() => handleReview(item.notificationId)}
                              disabled={processing[item.notificationId] === "reviewing"}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", border: "none",
                                background: "color-mix(in srgb, var(--color-success) 12%, transparent)", color: "var(--color-success)",
                                opacity: processing[item.notificationId] === "reviewing" ? 0.6 : 1,
                              }}
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              {processing[item.notificationId] === "reviewing" ? "Reviewing..." : "Mark as Reviewed"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {item.type === "comment" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "color-mix(in srgb, var(--color-info) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MessageSquare className="w-5 h-5" style={{ color: "var(--color-info)" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>
                              Comment on <span style={{ color: "var(--color-primary)" }}>{item.taskTitle}</span>
                            </p>
                            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                              <strong>{item.actor?.name || "Unknown"}</strong> · {fmtDateTime(item.commentedAt)}
                            </p>
                          </div>
                        </div>
                        <div style={{ padding: "10px 14px", background: "var(--bg-muted)", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5, fontStyle: "italic" }}>
                          {item.commentText || "No comment text"}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                          <span style={badgeStyle(STATUS_STYLE[item.priority]?.clr || "#6B6558")}>{item.priority}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock className="w-3.5 h-3.5" />
                            Deadline: {fmtDate(item.deadline)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Link
                            href={`/tasks/${item.taskId}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, background: "var(--bg-muted)", color: "var(--text-primary)", textDecoration: "none", border: "1px solid var(--border)" }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Task
                          </Link>
                          {item.notificationId && (
                            <button
                              onClick={() => handleReview(item.notificationId)}
                              disabled={processing[item.notificationId] === "reviewing"}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", border: "none",
                                background: "color-mix(in srgb, var(--color-success) 12%, transparent)", color: "var(--color-success)",
                                opacity: processing[item.notificationId] === "reviewing" ? 0.6 : 1,
                              }}
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              {processing[item.notificationId] === "reviewing" ? "Reviewing..." : "Mark as Reviewed"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {item.type === "extension_request" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "color-mix(in srgb, var(--color-warning) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <CalendarClock className="w-5 h-5" style={{ color: "var(--color-warning)" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>
                              Revised target date requested for <span style={{ color: "var(--color-primary)" }}>{item.taskTitle}</span>
                            </p>
                            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                              <strong>{item.actor?.name || "Unknown"}</strong> · {fmtDateTime(item.requestedAt)}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", background: "var(--bg-muted)", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-secondary)" }}>Current Deadline</span>
                            <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>{fmtDate(item.currentDeadline)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-secondary)" }}>Requested Revised Target Date</span>
                            <span style={{ color: "var(--color-warning)", fontWeight: 600 }}>{fmtDate(item.revisedTargetDate)}</span>
                          </div>
                          {item.reason && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Reason</span>
                              <span style={{ color: "var(--text-primary)", textAlign: "right", maxWidth: "60%" }}>{item.reason}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleExtensionResponse(item.taskId, item._id, "approved", item._id)}
                                disabled={processing[item._id] === "approved"}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "none",
                                  background: "color-mix(in srgb, var(--color-success) 12%, transparent)", color: "var(--color-success)",
                                  opacity: processing[item._id] ? 0.6 : 1,
                                }}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                {processing[item._id] === "approved" ? "Approving..." : "Approve"}
                              </button>
                              <button
                                onClick={() => handleExtensionResponse(item.taskId, item._id, "rejected", item._id)}
                                disabled={processing[item._id] === "rejected"}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "none",
                                  background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: "var(--color-danger)",
                                  opacity: processing[item._id] ? 0.6 : 1,
                                }}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                {processing[item._id] === "rejected" ? "Rejecting..." : "Reject"}
                              </button>
                            </>
                          )}
                          <Link
                            href={`/tasks/${item.taskId}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, background: "var(--bg-muted)", color: "var(--text-primary)", textDecoration: "none", border: "1px solid var(--border)" }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Task
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
