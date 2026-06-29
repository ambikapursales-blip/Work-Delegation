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
} from "lucide-react";
import { taskAPI, usersAPI, teamAPI } from "@/lib/api";

export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("view"); // "create" or "view"
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
  const [expandedTask, setExpandedTask] = useState(null);
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

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};

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

      const response = await taskAPI.getTasks(filters);
      setTasks(response.data?.tasks || []);
    } catch (err) {
      setError("Failed to load tasks");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [taskViewTab, dateFilter, startDate, endDate, userFilter, canAssignTasks]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data?.users || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
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
      await taskAPI.addComment(taskId, { text: commentText });
      setSuccess("Comment added successfully");
      setCommentText("");
      setShowComments(null);
      fetchTasks();
    } catch (err) {
      setError("Failed to add comment");
    }
  };

  const handleReassign = async (taskId) => {
    if (!reassignTo) return;
    try {
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
    }
  };

  const handleEscalate = async (taskId) => {
    if (!escalateTo || !escalationReason.trim()) {
      setError("Please select a user and provide a reason");
      return;
    }
    try {
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
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await taskAPI.deleteTask(taskId);
      fetchTasks();
    } catch (err) {
      setError("Failed to delete task");
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
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Critical: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
      High: "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
      Medium: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
      Low: "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
    };
    return colors[priority] || "bg-white/10 text-white/60 border-white/10";
  };

  const getStatusColor = (status) => {
    return status === "completed"
      ? "bg-white/[0.04] border-white/[0.06]"
      : "bg-white/[0.02] border-white/[0.06]";
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

  const handleTaskCreate = () => {
    setActiveTab("create");
  };

  return (
    <div className="min-h-screen bg-[#0B1220]">
      {/* Header with Create Task */}
      <div className="sticky top-0 z-30 bg-[#0A0F1A]/80 backdrop-blur-xl border-b border-white/[0.06] shadow-glass-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Tasks
            </h1>
            <p className="text-white/50 text-base mt-1 font-medium">
              {canAssignTasks ? "Manage all tasks" : "Your assigned tasks"}
            </p>
          </div>
          {canAssignTasks && (
            <Button
              onClick={handleTaskCreate}
              className="bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] hover:shadow-neon rounded-xl font-bold text-base px-6 py-3"
            >
              <Plus className="h-5 w-5 mr-2" />
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
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto backdrop-blur-sm">
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl rounded-2xl border-white/[0.08]">
              <CardHeader className="bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[#0B1220]">
                      Create New Task
                    </CardTitle>
                    <CardDescription className="text-[#0B1220]/70">
                      Assign tasks to team members
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => setActiveTab("view")}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="font-medium text-white/80">
                      Task Title *
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Enter task title"
                      required
                      className="mt-2 h-11 rounded-xl bg-white/[0.05] border-white/[0.1] text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="font-medium text-white/80">
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
                      placeholder="Enter task description"
                      className="mt-2 w-full px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30 focus:border-[#00FF88]/50"
                      rows="3"
                    />
                  </div>

                  <div>
                    <Label htmlFor="assignedTo" className="font-medium text-white/80">
                      Assign To *
                    </Label>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-white/[0.1] bg-white/[0.03] rounded-xl p-3">
                      {users.map((u) => (
                        <label
                          key={u._id}
                          className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white/[0.05] rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={formData.assignedTo.includes(u._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  assignedTo: [...formData.assignedTo, u._id],
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
                            className="rounded border-white/30 bg-white/10 w-4 h-4 accent-[#00FF88]"
                          />
                          <span className="text-sm font-medium text-white/85">{u.name}</span>
                          <span className="text-xs text-white/40 ml-auto">
                            {u.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                    <Label htmlFor="priority" className="font-medium text-white/80">
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
                      className="mt-2 w-full px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30 focus:border-[#00FF88]/50"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                    </div>

                    <div>
                    <Label htmlFor="deadline" className="font-medium text-white/80">
                      Deadline
                    </Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deadline: e.target.value,
                        })
                      }
                      className="mt-2 h-11 rounded-xl bg-white/[0.05] border-white/[0.1] text-white"
                    />
                    </div>
                  </div>

                  {/* Recurring Task Section */}
                  <div className="border-t border-white/[0.08] pt-4">
                    <Label className="font-medium text-white/80 mb-3 block">
                      Recurring Task
                    </Label>
                    <div className="space-y-3">
                      <div className="flex gap-4 flex-wrap">
                        {["One-time", "daily", "weekly", "monthly"].map((type) => (
                          <label key={type} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="taskType"
                              value={type}
                              checked={formData.taskType === type}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taskType: e.target.value,
                                  isRecurring: type !== "One-time",
                                  recurrencePattern: type !== "One-time"
                                    ? {
                                        frequency: type,
                                        interval: 1,
                                        daysOfWeek: [],
                                        dayOfMonth: 1,
                                      }
                                    : formData.recurrencePattern,
                                })
                              }
                              className="w-4 h-4 text-[#00FF88] accent-[#00FF88]"
                            />
                            <span className="text-sm text-white/80">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] font-semibold rounded-xl h-11 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-neon"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#0B1220]/30 border-t-[#0B1220] rounded-full animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        "Create Task"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("view")}
                      disabled={isSubmitting}
                      className="rounded-xl h-11 border-white/[0.12] text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto backdrop-blur-sm">
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl rounded-2xl border-white/[0.08]">
              <CardHeader className="bg-gradient-to-r from-[#00D4FF] to-[#0099CC] text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Edit Task</CardTitle>
                    <CardDescription className="text-white/70">
                      Update task details
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => setEditingTask(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="edit-title" className="font-medium text-white/80">
                      Task Title *
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
                      placeholder="Enter task title"
                      required
                      className="mt-2 h-11 rounded-xl bg-white/[0.05] border-white/[0.1] text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-description" className="font-medium text-white/80">
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
                      placeholder="Enter task description"
                      className="mt-2 w-full px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
                      rows="3"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-priority" className="font-medium text-white/80">
                      Priority *
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
                      className="mt-2 w-full px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="edit-deadline" className="font-medium text-white/80">
                      Deadline *
                    </Label>
                    <Input
                      id="edit-deadline"
                      type="date"
                      value={editFormData.deadline}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          deadline: e.target.value,
                        })
                      }
                      required
                      className="mt-2 h-11 rounded-xl bg-white/[0.05] border-white/[0.1] text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-assignedTo" className="font-medium text-white/80">
                      Assign To *
                    </Label>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-white/[0.1] bg-white/[0.03] rounded-xl p-3">
                      {users.map((u) => (
                        <label
                          key={u._id}
                          className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white/[0.05] rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={editFormData.assignedTo.includes(u._id)}
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
                                  assignedTo: editFormData.assignedTo.filter(
                                    (id) => id !== u._id,
                                  ),
                                });
                              }
                            }}
                            className="rounded border-white/30 bg-white/10 w-4 h-4 accent-[#00FF88]"
                          />
                          <span className="text-sm font-medium text-white/85">{u.name}</span>
                          <span className="text-xs text-white/40 ml-auto">
                            {u.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] font-semibold rounded-xl h-11 hover:shadow-neon"
                    >
                      Update Task
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingTask(null)}
                      className="rounded-xl h-11 border-white/[0.12] text-white/70 hover:text-white"
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
                <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-[#00FF88] animate-spin mx-auto mb-4" />
                <p className="text-white/60 font-medium">Loading tasks...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-6 py-6">
              {/* Filter Bar */}
              <div className="glass-card p-5 mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium text-white/70">
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
                          onClick={() => setTaskViewTab(status)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            taskViewTab === status
                              ? "bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] font-semibold shadow-neon"
                              : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white/90"
                          }`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium text-white/70">
                      Period:
                    </span>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.08] text-white border border-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
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
                      <span className="text-sm font-medium text-white/70">
                        User:
                      </span>
                      <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.08] text-white border border-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
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
                  <div className="flex gap-4 mt-4 pt-4 border-t border-white/[0.08]">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-white/60 mb-1 block">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.08] text-white border border-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-white/60 mb-1 block">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.08] text-white border border-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks Table */}
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Task
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Assigned To
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Deadline
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksToDisplay.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 rounded-2xl bg-white/[0.05] flex items-center justify-center">
                                <CheckCircle2 size={28} className="text-white/20" />
                              </div>
                              <p className="text-white/50 font-medium">
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

                          const statusColor =
                            {
                              Completed:
                                "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
                              "In Progress":
                                "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
                              Pending:
                                "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
                              Overdue: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
                            }[status] ||
                            "bg-white/10 text-white/60 border-white/10";

                          return (
                            <Fragment key={task._id}>
                              <tr
                                className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${canAssignTasks && task.status === "Completed" ? "cursor-pointer" : ""}`}
                                onClick={() =>
                                  canAssignTasks &&
                                  task.status === "Completed" &&
                                  setExpandedTask(
                                    expandedTask === task._id ? null : task._id,
                                  )
                                }
                              >
                                <td className="px-4 py-3 max-w-xs">
                                  <div>
                                    <p className="font-medium text-white/85 text-sm truncate">
                                      {task.title}
                                    </p>
                                    {task.description && (
                                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2 truncate">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor}`}
                                  >
                                    {status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}
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
                                              className="text-xs font-medium text-[#00D4FF] bg-[#00D4FF]/10 px-2 py-1 rounded-md border border-[#00D4FF]/20"
                                              title={user.name || user}
                                            >
                                              {user.name || "User"}
                                            </span>
                                          ))}
                                        {task.assignedTo.length > 3 && (
                                          <span className="text-xs font-medium text-white/50 bg-white/[0.05] px-2 py-1 rounded-md border border-white/[0.06]">
                                            +{task.assignedTo.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-white/30">
                                        Unassigned
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-white/50">
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
                                    className={`text-xs font-medium ${task.isRecurring ? "text-[#B366FF] bg-[#B366FF]/10 px-2 py-1 rounded-md border border-[#B366FF]/20" : "text-white/40"}`}
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
                                          className="p-1.5 text-[#00D4FF] hover:bg-[#00D4FF]/10 rounded-md transition-colors"
                                          title="Edit task"
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
                                        className="p-1.5 text-[#00FF88] hover:bg-[#00FF88]/10 rounded-md transition-colors"
                                        title="Mark as complete"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDelete(task._id)}
                                      className="p-1.5 text-[#FF6B6B] hover:bg-[#FF6B6B]/10 rounded-md transition-colors"
                                      title="Delete task"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {showCompleteInput === task._id && (
                                <tr className="bg-[#00FF88]/5" key="complete-input">
                                  <td colSpan="7" className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <label className="text-sm font-medium text-white/80">
                                        Completion Proof{" "}
                                        <span className="text-[#FF6B6B]">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={completionProof}
                                        onChange={(e) =>
                                          setCompletionProof(e.target.value)
                                        }
                                        placeholder="Enter proof (URL, description...)"
                                        className="flex-1 max-w-md px-3 py-2 text-sm bg-white/[0.08] border border-white/[0.1] rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00FF88]/30"
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
                                        className="btn-primary px-4 py-2 text-sm"
                                      >
                                        Submit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setShowCompleteInput(null);
                                          setCompletionProof("");
                                        }}
                                        className="btn-outline px-4 py-2 text-sm"
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
                                  <tr className="bg-white/[0.02]">
                                    <td colSpan="7" className="px-4 py-4">
                                      <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-white">
                                          Completion Details
                                        </h4>
                                        <div className="bg-white/[0.05] rounded-lg p-4 border border-white/[0.08]">
                                          <p className="text-xs font-medium text-white/50 mb-2">
                                            Completion Proof:
                                          </p>
                                          <p className="text-sm text-white/70">
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
                                              <p className="text-xs text-white/40 mt-2">
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
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
