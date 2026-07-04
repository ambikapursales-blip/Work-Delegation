"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import dynamic from "next/dynamic";
const TaskBoard = dynamic(() => import("@/components/TaskBoard"), { ssr: false });
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Toast from "@/components/Toast";
import {
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Calendar,
  ChevronDown,
  Clock,
  Repeat,
  ListTodo,
  Sparkles,
  Check,
} from "lucide-react";
import { taskAPI, usersAPI, teamAPI } from "@/lib/api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LoadingSpinner } from "@/components/loading";

/* ─── Badge / tag colour helpers ─── */
const priorityStyle = (p) => {
  const m = {
    Critical: { bg: "color-mix(in srgb, var(--color-danger) 12%, transparent)", clr: "var(--color-danger)",  bd: "color-mix(in srgb, var(--color-danger) 22%, transparent)" },
    High:     { bg: "color-mix(in srgb, var(--color-warning) 12%, transparent)",  clr: "var(--color-warning)", bd: "color-mix(in srgb, var(--color-warning) 22%, transparent)" },
    Medium:   { bg: "color-mix(in srgb, var(--color-info) 12%, transparent)",  clr: "var(--color-info)",   bd: "color-mix(in srgb, var(--color-info) 22%, transparent)" },
    Low:      { bg: "color-mix(in srgb, var(--color-success) 12%, transparent)",  clr: "var(--color-success)", bd: "color-mix(in srgb, var(--color-success) 22%, transparent)" },
  };
  const c = m[p];
  return c
    ? { background: c.bg, color: c.clr, border: `1px solid ${c.bd}` }
    : { background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px solid var(--border)" };
};

const statusStyle = (s) => {
  const m = {
    Completed:   { bg: "color-mix(in srgb, var(--color-success) 12%, transparent)",  clr: "var(--color-success)", bd: "color-mix(in srgb, var(--color-success) 22%, transparent)" },
    "In Progress": { bg: "color-mix(in srgb, var(--color-info) 12%, transparent)",  clr: "var(--color-info)",   bd: "color-mix(in srgb, var(--color-info) 22%, transparent)" },
    Pending:     { bg: "color-mix(in srgb, var(--color-warning) 12%, transparent)",  clr: "var(--color-warning)", bd: "color-mix(in srgb, var(--color-warning) 22%, transparent)" },
    Overdue:     { bg: "color-mix(in srgb, var(--color-danger) 12%, transparent)", clr: "var(--color-danger)",  bd: "color-mix(in srgb, var(--color-danger) 22%, transparent)" },
  };
  const c = m[s];
  return c
    ? { background: c.bg, color: c.clr, border: `1px solid ${c.bd}` }
    : { background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px solid var(--border)" };
};

const tagStyle = (clrVar, bgOpacity = "0.12", bdOpacity = "0.22") => {
  // Return a partial style – caller provides the variable value at usage time
  return { background: `color-mix(in srgb, ${clrVar} 12%, transparent)`, color: clrVar, border: `1px solid color-mix(in srgb, ${clrVar} 22%, transparent)` };
};

export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("view"); // "create" or "view"
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: [],
    priority: "Medium",
    deadline: "",
    taskType: "One-time",
    isRecurring: false,
    recurrencePattern: {
      frequency: "daily",
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: 1,
    },
    recurrenceEndDate: "",
  });
  const [showComments, setShowComments] = useState(null);
  const [showReassign, setShowReassign] = useState(null);
  const [showEscalate, setShowEscalate] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [escalateTo, setEscalateTo] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [showCompleteInput, setShowCompleteInput] = useState(null);
  const [completionProof, setCompletionProof] = useState("");
  const [selectedTaskForModal, setSelectedTaskForModal] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    priority: "Medium",
    deadline: "",
    assignedTo: [],
  });
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [commentingTaskId, setCommentingTaskId] = useState(null);
  const [reassigningTaskId, setReassigningTaskId] = useState(null);
  const [escalatingTaskId, setEscalatingTaskId] = useState(null);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Initialize taskViewTab from URL params to avoid race condition
  const getInitialTab = () => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      const statusMap = {
        completed: "completed",
        pending: "pending",
        inprogress: "inprogress",
        overdue: "overdue",
      };
      if (statusMap[statusParam.toLowerCase()])
        return statusMap[statusParam.toLowerCase()];
    }
    return "all";
  };
  const [taskViewTab, setTaskViewTab] = useState(getInitialTab); // "all", "completed", "inprogress", "pending", "overdue"
  const [dateFilter, setDateFilter] = useState("all"); // "all", "today", "thisWeek", "thisMonth", "custom"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userFilter, setUserFilter] = useState(""); // user ID filter

  const canAssignTasks = ["Admin", "Manager"].includes(user?.role);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setIsSearching(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Show searching state when typing
  useEffect(() => {
    if (searchQuery !== debouncedSearchQuery) {
      setIsSearching(true);
    }
  }, [searchQuery, debouncedSearchQuery]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {
        page: currentPage,
        limit: 15,
      };

      if (taskViewTab !== "all") {
        if (taskViewTab === "completed") filters.status = "Completed";
        else if (taskViewTab === "inprogress") filters.status = "In Progress";
        else if (taskViewTab === "pending") filters.status = "Pending";
        else if (taskViewTab === "overdue") filters.overdue = "true";
      }

      if (dateFilter === "today") {
        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        endOfDay.setHours(23, 59, 59, 999);
        filters.startDate = startOfDay.toISOString();
        filters.endDate = endOfDay.toISOString();
      } else if (dateFilter === "thisWeek") {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        filters.startDate = startOfWeek.toISOString();
      } else if (dateFilter === "thisMonth") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.startDate = startOfMonth.toISOString();
      } else if (dateFilter === "custom" && startDate) {
        filters.startDate = new Date(startDate).toISOString();
        if (endDate) {
          filters.endDate = new Date(endDate).toISOString();
        }
      }

      if (userFilter && canAssignTasks) {
        filters.assignedTo = userFilter;
      }

      if (debouncedSearchQuery.trim()) {
        filters.search = debouncedSearchQuery.trim();
      }

      const response = await taskAPI.getTasks(filters);
      setTasks(response.data?.tasks || []);
      setTotalTasks(response.data?.total || 0);
    } catch (err) {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [taskViewTab, dateFilter, startDate, endDate, userFilter, canAssignTasks, currentPage, debouncedSearchQuery]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data?.users || []);
    } catch (err) {
      setError("Failed to load user list for task assignment");
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    if (canAssignTasks) {
      fetchUsers();
    }
  }, [fetchTasks, fetchUsers, canAssignTasks]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const taskData = {
        ...formData,
        assignedTo:
          formData.assignedTo.length > 0
            ? formData.assignedTo
            : [users[0]?._id],
        deadline:
          formData.deadline ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
      };
      await taskAPI.createTask(taskData);
      setSuccess("Task created successfully!");
      setFormData({
        title: "",
        description: "",
        assignedTo: [],
        priority: "Medium",
        deadline: "",
        taskType: "One-time",
        isRecurring: false,
        recurrencePattern: {
          frequency: "daily",
          interval: 1,
          daysOfWeek: [],
          dayOfMonth: 1,
        },
        recurrenceEndDate: "",
      });
      fetchTasks();
      setActiveTab("view");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (taskId) => {
    if (!commentText.trim()) return;
    try {
      setCommentingTaskId(taskId);
      await taskAPI.addComment(taskId, { text: commentText });
      setSuccess("Comment added successfully");
      setCommentText("");
      setShowComments(null);
      fetchTasks();
    } catch (err) {
      setError("Failed to add comment");
    } finally {
      setCommentingTaskId(null);
    }
  };

  const handleReassign = async (taskId) => {
    if (!reassignTo) return;
    try {
      setReassigningTaskId(taskId);
      const task = tasks.find((t) => t._id === taskId);
      await taskAPI.reassign(taskId, {
        fromUserId: task.assignedTo[0]?._id,
        toUserId: reassignTo,
        reason: "Reassigned by manager",
      });
      setSuccess("Task reassigned successfully");
      setReassignTo("");
      setShowReassign(null);
      fetchTasks();
    } catch (err) {
      setError("Failed to reassign task");
    } finally {
      setReassigningTaskId(null);
    }
  };

  const handleEscalate = async (taskId) => {
    if (!escalateTo || !escalationReason.trim()) {
      setError("Please select a user and provide a reason");
      return;
    }
    try {
      setEscalatingTaskId(taskId);
      await taskAPI.escalate(taskId, {
        escalatedTo: escalateTo,
        reason: escalationReason,
      });
      setSuccess("Task escalated successfully");
      setEscalateTo("");
      setEscalationReason("");
      setShowEscalate(null);
      fetchTasks();
    } catch (err) {
      setError("Failed to escalate task");
    } finally {
      setEscalatingTaskId(null);
    }
  };

  const handleComplete = async (taskId) => {
    setShowCompleteInput(taskId);
  };

  const handleCompleteSubmit = async (taskId) => {
    if (!completionProof.trim()) {
      setError("Please provide completion proof");
      return;
    }

    try {
      setCompletingTaskId(taskId);
      await taskAPI.updateTask(taskId, {
        status: "completed",
        completionProof,
      });
      setShowCompleteInput(null);
      setCompletionProof("");
      setSuccess("Task marked as completed successfully");
      fetchTasks();
    } catch (err) {
      setError("Failed to mark task as completed");
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      setDeletingTaskId(taskId);
      await taskAPI.deleteTask(taskId);
      setSuccess("Task deleted successfully");
      fetchTasks();
    } catch (err) {
      setError("Failed to delete task");
    } finally {
      setDeletingTaskId(null);
    }
  };

  const handleSelectTask = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleSelectAllTasks = () => {
    if (selectedTasks.length === tasksToDisplay.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasksToDisplay.map(task => task._id));
    }
  };

  const handleFilterChange = (filterType, value) => {
    setCurrentPage(1);
    if (filterType === "taskViewTab") setTaskViewTab(value);
    if (filterType === "dateFilter") setDateFilter(value);
    if (filterType === "userFilter") setUserFilter(value);
  };

  const handleBulkDeleteTasks = async () => {
    if (selectedTasks.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedTasks.length} task(s)?`)) return;
    
    try {
      setBulkDeleting(true);
      await Promise.all(selectedTasks.map(id => taskAPI.deleteTask(id)));
      setSuccess(`${selectedTasks.length} task(s) deleted successfully!`);
      setSelectedTasks([]);
      fetchTasks();
    } catch (err) {
      setError("Failed to delete some tasks");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setEditFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      deadline: task.deadline ? task.deadline.split("T")[0] : "",
      assignedTo: Array.isArray(task.assignedTo)
        ? task.assignedTo.map((u) => (typeof u === "object" ? u._id : u))
        : [task.assignedTo],
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setEditingSubmitting(true);
      await taskAPI.updateTask(editingTask._id, editFormData);
      setSuccess("Task updated successfully");
      setEditingTask(null);
      setEditFormData({
        title: "",
        description: "",
        priority: "Medium",
        deadline: "",
        assignedTo: [],
      });
      fetchTasks();
    } catch (err) {
      setError("Failed to update task");
    } finally {
      setEditingSubmitting(false);
    }
  };

  const filteredTasks = canAssignTasks
    ? tasks
    : tasks.filter((task) =>
        Array.isArray(task.assignedTo)
          ? task.assignedTo.some((a) => a._id === user?._id)
          : task.assignedTo?._id === user?._id ||
            task.author?._id === user?._id,
      );

  const tasksToDisplay = filteredTasks;

  // UI date helpers (no business logic)
  const toDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split("T")[0].split("-");
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  };
  const toDateStr = (date) => {
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const handleTaskCreate = () => {
    setActiveTab("create");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Header with Create Task */}
      <div
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Tasks
            </h1>
            <p className="text-base mt-1 font-medium" style={{ color: "var(--text-secondary)" }}>
              {canAssignTasks ? "Manage all tasks" : "Your assigned tasks"}
            </p>
          </div>
          {canAssignTasks && (
            <Button
              onClick={handleTaskCreate}
              className="btn-create-task font-bold text-base px-6 py-3 rounded-xl"
              style={{ color: "var(--active-text)" }}
            >
              <Plus className="h-5 w-5 mr-2" style={{ color: "var(--active-text)" }} />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Toast type="error" message={error} onClose={() => setError("")} />
      )}

      {success && (
        <Toast
          type="success"
          message={success}
          onClose={() => setSuccess("")}
        />
      )}

      {/* Create Task Modal */}
      {canAssignTasks && activeTab === "create" && (
        <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm animate-fade-in"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-3xl relative overflow-hidden">
              {/* Ambient glow */}
              <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "color-mix(in srgb, var(--color-success) 6%, transparent)" }} />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "color-mix(in srgb, var(--color-info) 6%, transparent)" }} />

              <CardHeader className="px-8 py-6 relative z-10"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl p-[2px] flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)" }}>
                      <div className="w-full h-full rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "var(--bg-card)" }}>
                        <Plus className="w-6 h-6" style={{ color: "var(--active-start)" }} />
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold tracking-tight">
                        Create New Task
                      </CardTitle>
                      <CardDescription className="mt-1 text-base">
                        Assign tasks to team members
                      </CardDescription>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("view")}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 group"
                    style={{
                      backgroundColor: "var(--bg-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <X className="w-5 h-5 transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"} />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="px-8 py-6 relative z-10">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Title - Full width */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}>
                      Task Title <span style={{ color: "var(--color-danger)" }}>*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="e.g., Design new landing page"
                      required
                      className="input-field h-[52px] text-base"
                    />
                  </div>

                  {/* Row: Assign To | Priority */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Assign To <span style={{ color: "var(--color-danger)" }}>*</span>
                      </Label>
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-2xl p-2"
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                        }}>
                        {users.length === 0 ? (
                          <p className="text-sm p-3 text-center" style={{ color: "var(--text-muted)" }}>Loading users...</p>
                        ) : (
                          users.map((u) => {
                            const isSelected = formData.assignedTo.includes(u._id);
                            return (
                              <label
                                key={u._id}
                                className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-200"
                                style={{
                                  backgroundColor: isSelected ? "color-mix(in srgb, var(--color-success) 8%, transparent)" : "transparent",
                                  border: isSelected ? "1px solid color-mix(in srgb, var(--color-success) 0.2)" : "1px solid transparent",
                                }}
                              >
                                <div
                                  className="w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0"
                                  style={{
                                    backgroundColor: isSelected ? "var(--color-success)" : "var(--bg-muted)",
                                    borderColor: isSelected ? "var(--color-success)" : "var(--border)",
                                  }}
                                >
                                  {isSelected && (
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--text-inverse)" }} />
                                  )}
                                </div>
                                <div className="flex-1 flex items-center justify-between min-w-0">
                                  <span
                                    className="text-sm font-medium truncate"
                                    style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
                                  >
                                    {u.name}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0 ml-2"
                                    style={{
                                      color: "var(--text-muted)",
                                      backgroundColor: "var(--bg-muted)",
                                    }}>
                                    {u.role}
                                  </span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        assignedTo: [
                                          ...formData.assignedTo,
                                          u._id,
                                        ],
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        assignedTo: formData.assignedTo.filter(
                                          (id) => id !== u._id,
                                        ),
                                      });
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Priority
                      </Label>
                      <select
                        id="priority"
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            priority: e.target.value,
                          })
                        }
                        className="input-field h-[52px] text-base"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* Row: Deadline | Task Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="deadline" className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Deadline
                      </Label>
                      <DatePicker
                        selected={toDate(formData.deadline)}
                        onChange={(date) =>
                          setFormData({
                            ...formData,
                            deadline: toDateStr(date),
                          })
                        }
                        dateFormat="dd MMM yyyy"
                        placeholderText="Select deadline"
                        className="input-field h-[52px] text-base cursor-pointer"
                        wrapperClassName="w-full"
                        popperClassName="react-datepicker-dark"
                        calendarClassName="react-datepicker-dark-calendar"
                        isClearable
                        showPopperArrow={false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Task Type
                      </Label>
                      <div className="flex gap-2 rounded-xl p-1.5"
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                        }}>
                        {[
                          { value: "One-time", label: "One-time" },
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ].map(({ value, label }) => (
                          <label
                            key={value}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200 text-sm font-medium"
                            style={
                              formData.taskType === value
                                ? {
                                    background: "linear-gradient(135deg, color-mix(in srgb, var(--primary-mid) 18%, transparent) 0%, color-mix(in srgb, var(--accent) 18%, transparent) 100%)",
                                    color: "var(--color-info)",
                                    border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                                  }
                                : {
                                    color: "var(--text-muted)",
                                    border: "1px solid transparent",
                                  }
                            }
                          >
                            <input
                              type="radio"
                              name="taskType"
                              value={value}
                              checked={formData.taskType === value}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taskType: e.target.value,
                                  isRecurring: value !== "One-time",
                                  recurrencePattern:
                                    value !== "One-time"
                                      ? {
                                          frequency: value,
                                          interval: 1,
                                          daysOfWeek: [],
                                          dayOfMonth: 1,
                                        }
                                      : formData.recurrencePattern,
                                })
                              }
                              className="hidden"
                            />
                            {value === "One-time" ? (
                              <ListTodo className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : value === "daily" ? (
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : value === "weekly" ? (
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                              <Repeat className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span className="hidden sm:inline">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recurring Pattern Options */}
                  {formData.taskType !== "One-time" && (
                    <div className="space-y-3 rounded-2xl p-4 animate-fade-in"
                      style={{
                        backgroundColor: "var(--bg-muted)",
                        border: "1px solid var(--border)",
                      }}>
                      <Label className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Recurrence Details
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium"
                            style={{ color: "var(--text-muted)" }}>
                            Repeat every
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={formData.recurrencePattern.interval}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                recurrencePattern: {
                                  ...formData.recurrencePattern,
                                  interval: parseInt(e.target.value) || 1,
                                },
                              })
                            }
                            className="input-field h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium"
                            style={{ color: "var(--text-muted)" }}>
                            End Date
                          </Label>
                          <DatePicker
                            selected={toDate(formData.recurrenceEndDate)}
                            onChange={(date) =>
                              setFormData({
                                ...formData,
                                recurrenceEndDate: toDateStr(date),
                              })
                            }
                            dateFormat="dd MMM yyyy"
                            placeholderText="No end date"
                            className="input-field h-11 text-sm cursor-pointer"
                            wrapperClassName="w-full"
                            popperClassName="react-datepicker-dark"
                            calendarClassName="react-datepicker-dark-calendar"
                            isClearable
                            showPopperArrow={false}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Description
                    </Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe the task, requirements, and any relevant details..."
                      className="input-field min-h-[140px] resize-y text-base"
                      rows="4"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-4 pt-4"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      loadingText="Creating..."
                      style={{
                        background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                        color: "var(--active-text)",
                        boxShadow: "0 2px 12px color-mix(in srgb, var(--active-start) 30%, transparent)",
                      }}
                      className="h-[52px] font-bold text-base rounded-xl"
                    >
                      Create Task
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("view")}
                      disabled={isSubmitting}
                      className="h-[52px] font-medium text-base rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm animate-fade-in"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-3xl relative overflow-hidden">
              {/* Ambient glow */}
              <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "color-mix(in srgb, var(--color-info) 6%, transparent)" }} />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "color-mix(in srgb, var(--color-success) 6%, transparent)" }} />

              <CardHeader className="px-8 py-6 relative z-10"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl p-[2px] flex-shrink-0"
style={{ background: "linear-gradient(135deg, var(--color-info) 0%, var(--accent) 100%)" }}>
          <div className="w-full h-full rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "var(--bg-card)" }}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: "var(--color-info)" }}
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold tracking-tight">
                        Edit Task
                      </CardTitle>
                      <CardDescription className="mt-1 text-base">
                        Update task details
                      </CardDescription>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingTask(null)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 group"
                    style={{
                      backgroundColor: "var(--bg-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <X className="w-5 h-5 transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"} />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="px-8 py-6 relative z-10">
                <form onSubmit={handleEditSubmit} className="space-y-5">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-title" className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}>
                      Task Title <span style={{ color: "var(--color-danger)" }}>*</span>
                    </Label>
                    <Input
                      id="edit-title"
                      value={editFormData.title}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          title: e.target.value,
                        })
                      }
                      placeholder="e.g., Design new landing page"
                      required
                      className="input-field h-[52px] text-base"
                    />
                  </div>

                  {/* Row: Assign To | Priority */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Assign To <span style={{ color: "var(--color-danger)" }}>*</span>
                      </Label>
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-2xl p-2"
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                        }}>
                        {users.length === 0 ? (
                          <p className="text-sm p-3 text-center" style={{ color: "var(--text-muted)" }}>Loading users...</p>
                        ) : (
                          users.map((u) => {
                            const isSelected = editFormData.assignedTo.includes(u._id);
                            return (
                              <label
                                key={u._id}
                                className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-200"
                                style={{
                                  backgroundColor: isSelected ? "color-mix(in srgb, var(--color-success) 8%, transparent)" : "transparent",
                                  border: isSelected ? "1px solid color-mix(in srgb, var(--color-success) 0.2)" : "1px solid transparent",
                                }}
                              >
                                <div
                                  className="w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0"
                                  style={{
                                    backgroundColor: isSelected ? "var(--color-success)" : "var(--bg-muted)",
                                    borderColor: isSelected ? "var(--color-success)" : "var(--border)",
                                  }}
                                >
                                  {isSelected && (
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--text-inverse)" }} />
                                  )}
                                </div>
                                <div className="flex-1 flex items-center justify-between min-w-0">
                                  <span
                                    className="text-sm font-medium truncate"
                                    style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
                                  >
                                    {u.name}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0 ml-2"
                                    style={{
                                      color: "var(--text-muted)",
                                      backgroundColor: "var(--bg-muted)",
                                    }}>
                                    {u.role}
                                  </span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditFormData({
                                        ...editFormData,
                                        assignedTo: [
                                          ...editFormData.assignedTo,
                                          u._id,
                                        ],
                                      });
                                    } else {
                                      setEditFormData({
                                        ...editFormData,
                                        assignedTo:
                                          editFormData.assignedTo.filter(
                                            (id) => id !== u._id,
                                          ),
                                      });
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-priority" className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Priority <span style={{ color: "var(--color-danger)" }}>*</span>
                      </Label>
                      <select
                        id="edit-priority"
                        value={editFormData.priority}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            priority: e.target.value,
                          })
                        }
                        className="input-field h-[52px] text-base"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* Row: Deadline | Description */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="edit-deadline" className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}>
                        Deadline <span style={{ color: "var(--color-danger)" }}>*</span>
                      </Label>
                      <DatePicker
                        selected={toDate(editFormData.deadline)}
                        onChange={(date) =>
                          setEditFormData({
                            ...editFormData,
                            deadline: toDateStr(date),
                          })
                        }
                        dateFormat="dd MMM yyyy"
                        placeholderText="Select deadline"
                        className="input-field h-[52px] text-base cursor-pointer"
                        wrapperClassName="w-full"
                        popperClassName="react-datepicker-dark"
                        calendarClassName="react-datepicker-dark-calendar"
                        isClearable
                        showPopperArrow={false}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-description"
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Description
                    </Label>
                    <textarea
                      id="edit-description"
                      value={editFormData.description}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe the task, requirements, and any relevant details..."
                      className="input-field min-h-[140px] resize-y text-base"
                      rows="4"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-4 pt-4"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    <Button
                      type="submit"
                      loading={editingSubmitting}
                      loadingText="Updating..."
                      style={{
                        background: "linear-gradient(135deg, var(--color-info) 0%, var(--accent) 100%)",
                        color: "white",
                        boxShadow: "0 2px 12px color-mix(in srgb, var(--color-info) 0.3)",
                      }}
                      className="h-[52px] font-bold text-base rounded-xl"
                    >
                      Update Task
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingTask(null)}
                      disabled={editingSubmitting}
                      className="h-[52px] font-medium text-base rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Task Board - Main View */}
      {!canAssignTasks || activeTab === "view" ? (
        <>
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 animate-spin mx-auto mb-4"
                  style={{
                    borderColor: "var(--border)",
                    borderTopColor: "var(--color-success)",
                  }} />
                <p className="font-medium" style={{ color: "var(--text-muted)" }}>Loading tasks...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-6 py-6">
              {/* Filter Bar */}
              <div className="glass-card p-5 mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                      Status:
                    </span>
                    <div className="flex gap-2">
                      {[
                        "all",
                        "completed",
                        "inprogress",
                        "pending",
                        "overdue",
                      ].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setTaskViewTab(status);
                            setCurrentPage(1);
                          }}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                          style={
                            taskViewTab === status
                              ? {
                                  background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                                  color: "var(--active-text)",
                                  fontWeight: 600,
                                  boxShadow: "0 4px 14px color-mix(in srgb, var(--active-end) 40%, transparent)",
                                }
                              : {
                                  backgroundColor: "var(--bg-muted)",
                                  color: "var(--text-muted)",
                                }
                          }
                          onMouseEnter={(e) => {
                            if (taskViewTab !== status) {
                              e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
                              e.currentTarget.style.color = "var(--text-primary)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (taskViewTab !== status) {
                              e.currentTarget.style.backgroundColor = "var(--bg-muted)";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }
                          }}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                      Period:
                    </span>
                    <select
                      value={dateFilter}
                      onChange={(e) => {
                        setDateFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="input-field text-sm font-medium"
                      style={{ width: "auto", minWidth: "140px" }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="thisWeek">This Week</option>
                      <option value="thisMonth">This Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {canAssignTasks && (
                    <div className="flex flex-wrap gap-3 items-center">
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        User:
                      </span>
                      <select
                        value={userFilter}
                        onChange={(e) => {
                          setUserFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="input-field text-sm font-medium"
                        style={{ width: "auto", minWidth: "140px" }}
                      >
                        <option value="">All Users</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Custom Date Range */}
                {dateFilter === "custom" && (
                  <div className="flex gap-4 mt-4 pt-4"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-1 block"
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
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-1 block"
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
                  </div>
                )}
              </div>

              {/* Tasks Table */}
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3"
                  style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search tasks by title or description..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="input-field w-full text-sm pl-9"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                      style={{ color: "var(--text-muted)" }}>
                      {isSearching ? "⏳" : "🔍"}
                    </span>
                  </div>
                </div>
                {selectedTasks.length > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3"
                    style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={handleBulkDeleteTasks}
                      disabled={bulkDeleting}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                        color: "var(--color-danger)",
                        border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
                        opacity: bulkDeleting ? 0.6 : 1,
                        cursor: bulkDeleting ? "not-allowed" : "pointer",
                      }}
                    >
                      {bulkDeleting ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Selected
                        </>
                      )}
                    </button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="table-head">
                        <th className="px-4 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selectedTasks.length === tasksToDisplay.length && tasksToDisplay.length > 0}
                            onChange={handleSelectAllTasks}
                          />
                        </th>
                        <th className="px-4 py-3 text-left">Task</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Priority</th>
                        <th className="px-4 py-3 text-left">Assigned To</th>
                        <th className="px-4 py-3 text-left">Deadline</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksToDisplay.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "var(--bg-muted)" }}>
                                <CheckCircle2 size={28} style={{ color: "var(--text-muted)" }} />
                              </div>
                              <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
                                No tasks found
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        tasksToDisplay.map((task) => {
                          const status =
                            task.status?.toLowerCase() === "completed"
                              ? "Completed"
                              : task.isOverdue
                                ? "Overdue"
                                : task.status?.toLowerCase() === "in progress"
                                  ? "In Progress"
                                  : "Pending";

                          return (
                            <Fragment key={task._id}>
                              <tr
                                className="table-row-hover transition-colors"
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                }}
                                onClick={() =>
                                  canAssignTasks &&
                                  task.status === "Completed" &&
                                  setExpandedTask(
                                    expandedTask === task._id ? null : task._id,
                                  )
                                }
                              >
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedTasks.includes(task._id)}
                                    onChange={() => handleSelectTask(task._id)}
                                  />
                                </td>
                                <td className="px-4 py-3 max-w-xs">
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskForModal(task);
                                      setShowTaskModal(true);
                                    }}
                                  >
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
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                                    style={statusStyle(status)}
                                  >
                                    {status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                                    style={priorityStyle(task.priority)}
                                  >
                                    {task.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {task.assignedTo &&
                                    task.assignedTo.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {task.assignedTo
                                          .slice(0, 3)
                                          .map((user, idx) => (
                                            <span
                                              key={idx}
                                              className="text-xs font-medium px-2 py-1 rounded-md border"
                                              style={{
                                                color: "var(--color-info)",
                                                backgroundColor: "color-mix(in srgb, var(--color-info) 8%, transparent)",
                                                borderColor: "color-mix(in srgb, var(--color-info) 0.2)",
                                              }}
                                              title={user.name || user}
                                            >
                                              {user.name || "User"}
                                            </span>
                                          ))}
                                        {task.assignedTo.length > 3 && (
                                          <span className="text-xs font-medium px-2 py-1 rounded-md border"
                                            style={{
                                              color: "var(--text-secondary)",
                                              backgroundColor: "var(--bg-muted)",
                                              borderColor: "var(--border)",
                                            }}>
                                            +{task.assignedTo.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                        Unassigned
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
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
                                <td className="px-4 py-3">
                                  <span
                                    className="text-xs font-medium px-2 py-1 rounded-md border"
                                    style={
                                      task.isRecurring
                                        ? {
                                            color: "var(--color-purple)",
                                            backgroundColor: "color-mix(in srgb, var(--color-purple) 8%, transparent)",
                                            borderColor: "color-mix(in srgb, var(--color-purple) 20%, transparent)",
                                          }
                                        : { color: "var(--text-muted)" }
                                    }
                                  >
                                    {task.taskType || "One-time"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    {(task.assignedBy?._id === user?._id ||
                                      task.assignedBy === user?._id) &&
                                      task.status !== "Completed" && (
                                        <button
                                          onClick={() => handleEdit(task)}
                                          className="p-1.5 rounded-md transition-colors"
                                          title="Edit task"
                                          style={{ color: "var(--color-info)" }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-info) 8%, transparent)"}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                          </svg>
                                        </button>
                                      )}
                                    {task.status !== "Completed" && (
                                      <button
                                        onClick={() => handleComplete(task._id)}
                                        className="p-1.5 rounded-md transition-colors"
                                        title="Mark as complete"
                                        style={{ color: "var(--color-success)" }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-success) 8%, transparent)"}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDelete(task._id)}
                                      disabled={deletingTaskId === task._id}
                                      className="p-1.5 rounded-md transition-colors"
                                      title="Delete task"
                                      style={{ 
                                        color: "var(--color-danger)",
                                        opacity: deletingTaskId === task._id ? 0.6 : 1,
                                        cursor: deletingTaskId === task._id ? "not-allowed" : "pointer",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (deletingTaskId !== task._id) {
                                          e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-danger) 8%, transparent)";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (deletingTaskId !== task._id) {
                                          e.currentTarget.style.backgroundColor = "transparent";
                                        }
                                      }}
                                    >
                                      {deletingTaskId === task._id ? (
                                        <LoadingSpinner size="sm" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {showCompleteInput === task._id && (
                                <tr key="complete-input"
                                  style={{ backgroundColor: "color-mix(in srgb, var(--color-success) 4%, transparent)" }}>
                                  <td colSpan="7" className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <label className="text-sm font-medium"
                                        style={{ color: "var(--text-primary)" }}>
                                        Completion Proof{" "}
                                        <span style={{ color: "var(--color-danger)" }}>*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={completionProof}
                                        onChange={(e) =>
                                          setCompletionProof(e.target.value)
                                        }
                                        placeholder="Enter proof (URL, description...)"
                                        className="input-field flex-1 max-w-md text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleCompleteSubmit(task._id);
                                          } else if (e.key === "Escape") {
                                            setShowCompleteInput(null);
                                            setCompletionProof("");
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() =>
                                          handleCompleteSubmit(task._id)
                                        }
                                        disabled={completingTaskId === task._id}
                                        className="btn-primary px-4 py-2 text-sm"
                                        style={{
                                          opacity: completingTaskId === task._id ? 0.6 : 1,
                                          cursor: completingTaskId === task._id ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        {completingTaskId === task._id ? (
                                          <>
                                            <LoadingSpinner size="sm" />
                                            Submitting...
                                          </>
                                        ) : (
                                          "Submit"
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setShowCompleteInput(null);
                                          setCompletionProof("");
                                        }}
                                        className="btn-secondary px-4 py-2 text-sm"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {expandedTask === task._id &&
                                canAssignTasks &&
                                task.status === "Completed" && (
                                  <tr style={{ backgroundColor: "var(--bg-muted)" }}>
                                    <td colSpan="7" className="px-4 py-4">
                                      <div className="space-y-3">
                                        <h4 className="text-sm font-semibold"
                                          style={{ color: "var(--text-primary)" }}>
                                          Completion Details
                                        </h4>
                                        <div className="rounded-lg p-4"
                                          style={{
                                            backgroundColor: "var(--bg-muted)",
                                            border: "1px solid var(--border)",
                                          }}>
                                          <p className="text-xs font-medium mb-2"
                                            style={{ color: "var(--text-secondary)" }}>
                                            Completion Proof:
                                          </p>
                                          <p className="text-sm"
                                            style={{ color: "var(--text-secondary)" }}>
                                            {(task.history &&
                                              task.history.find(
                                                (h) => h.status === "Completed",
                                              )?.note) ||
                                              "No completion proof provided"}
                                          </p>
                                          {task.history &&
                                            task.history.find(
                                              (h) => h.status === "Completed",
                                            )?.changedAt && (
                                              <p className="text-xs mt-2"
                                                style={{ color: "var(--text-muted)" }}>
                                                Completed on:{" "}
                                                {new Date(
                                                  task.history.find(
                                                    (h) =>
                                                      h.status === "Completed",
                                                  ).changedAt,
                                                ).toLocaleString()}
                                              </p>
                                            )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalTasks > 15 && (
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ borderTop: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Showing {((currentPage - 1) * 15) + 1} to {Math.min(currentPage * 15, totalTasks)} of {totalTasks} tasks
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-lg text-sm disabled:opacity-50 transition-colors"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Previous
                      </button>
                      <span className="text-sm px-2" style={{ color: "var(--text-primary)" }}>
                        Page {currentPage} of {Math.ceil(totalTasks / 15)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalTasks / 15), p + 1))}
                        disabled={currentPage >= Math.ceil(totalTasks / 15)}
                        className="px-3 py-1 rounded-lg text-sm disabled:opacity-50 transition-colors"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Task Detail Modal */}
      {showTaskModal && selectedTaskForModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowTaskModal(false)}
        >
          <div
            className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Task Details
                </h2>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: "var(--text-muted)" }}>
                    Subject
                  </label>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {selectedTaskForModal.title}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: "var(--text-muted)" }}>
                    Description
                  </label>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {selectedTaskForModal.description || "No description provided"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                      style={{ color: "var(--text-muted)" }}>
                      Status
                    </label>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={statusStyle(
                        selectedTaskForModal.status?.toLowerCase() === "completed"
                          ? "Completed"
                          : selectedTaskForModal.isOverdue
                            ? "Overdue"
                            : selectedTaskForModal.status?.toLowerCase() === "in progress"
                              ? "In Progress"
                              : "Pending"
                      )}
                    >
                      {selectedTaskForModal.status?.toLowerCase() === "completed"
                        ? "Completed"
                        : selectedTaskForModal.isOverdue
                          ? "Overdue"
                          : selectedTaskForModal.status?.toLowerCase() === "in progress"
                            ? "In Progress"
                            : "Pending"}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                      style={{ color: "var(--text-muted)" }}>
                      Priority
                    </label>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                      style={priorityStyle(selectedTaskForModal.priority)}
                    >
                      {selectedTaskForModal.priority}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                      style={{ color: "var(--text-muted)" }}>
                      Assigned To
                    </label>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {Array.isArray(selectedTaskForModal.assignedTo)
                        ? selectedTaskForModal.assignedTo.map(u => typeof u === "object" ? u.name : u).join(", ")
                        : selectedTaskForModal.assignedTo || "Unassigned"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                      style={{ color: "var(--text-muted)" }}>
                      Deadline
                    </label>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {selectedTaskForModal.deadline
                        ? new Date(selectedTaskForModal.deadline).toLocaleDateString()
                        : "No deadline"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide mb-1 block"
                    style={{ color: "var(--text-muted)" }}>
                    Type
                  </label>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {selectedTaskForModal.taskType || "One-time"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowTaskModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
