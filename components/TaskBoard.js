"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Search,
  Filter,
  Plus,
  User,
  Calendar,
  Tag,
  Trash2,
  Edit,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TaskBoard = ({
  tasks = [],
  onTaskUpdate,
  onTaskDelete,
  onTaskCreate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [sortBy, setSortBy] = useState("deadline");
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const statusConfig = {
    Pending: {
      label: "Pending",
      bgStyle: { background: "color-mix(in srgb, var(--color-warning) 10%, transparent)" },
      badgeClass: "badge-warning",
      textStyle: { color: "var(--color-warning)" },
      dotColor: "var(--color-warning)",
      icon: Clock,
    },
    "In Progress": {
      label: "In Progress",
      bgStyle: { background: "color-mix(in srgb, var(--color-info) 10%, transparent)" },
      badgeClass: "badge-info",
      textStyle: { color: "var(--color-info)" },
      dotColor: "var(--color-info)",
      icon: Zap,
    },
    Completed: {
      label: "Completed",
      bgStyle: { background: "color-mix(in srgb, var(--color-success) 10%, transparent)" },
      badgeClass: "badge-success",
      textStyle: { color: "var(--color-success)" },
      dotColor: "var(--color-success)",
      icon: CheckCircle2,
    },
    Overdue: {
      label: "OverDue",
      bgStyle: { background: "color-mix(in srgb, var(--color-danger) 10%, transparent)" },
      badgeClass: "badge-danger",
      textStyle: { color: "var(--color-danger)" },
      dotColor: "var(--color-danger)",
      icon: AlertCircle,
      count: 0,
    },
  };

  const getTaskStatus = (task) => {
    if (task.status === "Completed") return "Completed";
    if (task.isOverdue) return "Overdue";
    if (task.status === "In Progress") return "In Progress";
    return "Pending";
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const taskStatus = getTaskStatus(task);
      const matchesStatus = !selectedStatus || taskStatus === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      if (sortBy === "deadline") {
        return new Date(a.deadline) - new Date(b.deadline);
      } else if (sortBy === "priority") {
        const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (
          (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
        );
      }
      return 0;
    });

    return filtered;
  }, [tasks, searchQuery, selectedStatus, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = {
      Pending: 0,
      "In Progress": 0,
      Completed: 0,
      Overdue: 0,
    };
    tasks.forEach((task) => {
      const status = getTaskStatus(task);
      counts[status]++;
    });
    return counts;
  }, [tasks]);

  const getPriorityStyle = (priority) => {
    const styles = {
      Critical: { background: "color-mix(in srgb, var(--color-danger) 15%, transparent)", color: "var(--color-danger)", border: "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)" },
      High: { background: "color-mix(in srgb, var(--color-warning) 15%, transparent)", color: "var(--color-warning)", border: "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)" },
      Medium: { background: "color-mix(in srgb, var(--color-info) 15%, transparent)", color: "var(--color-info)", border: "1px solid color-mix(in srgb, var(--color-info) 25%, transparent)" },
      Low: { background: "color-mix(in srgb, var(--color-success) 15%, transparent)", color: "var(--color-success)", border: "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)" },
    };
    return styles[priority] || { background: "color-mix(in srgb, var(--text-secondary) 10%, transparent)", color: "var(--text-secondary)", border: "1px solid var(--border)" };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const daysUntilDeadline = (deadline) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return "Due today";
    return `${diffDays} days from now`;
  };

  return (
    <div className="w-full bg-[var(--bg-base)] min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Task Board</h1>
          <p className="text-[var(--text-secondary)]">
            Manage and track all your tasks in one place
          </p>
        </div>

        <div className="mb-8 space-y-4 lg:space-y-0">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-[var(--text-muted)]" />
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--color-success)] focus:ring-[var(--color-success)]"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="rounded-xl border-[var(--border)] hover:bg-[var(--bg-muted)] h-12 text-[var(--text-secondary)]"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                {filterOpen && (
                  <div className="absolute top-full mt-2 right-0 bg-[var(--bg-surface)] backdrop-blur-xl rounded-xl shadow-glass border border-[var(--border)] z-10 p-3 min-w-max">
                    <button
                      onClick={() => {
                        setSelectedStatus(null);
                        setFilterOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] font-medium"
                    >
                      All Status
                    </button>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedStatus(key);
                          setFilterOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                      >
                        {config.label} ({statusCounts[key]})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-1 bg-[var(--bg-muted)] rounded-xl p-1 border border-[var(--border)]">
                <button
                  onClick={() => setSortBy("deadline")}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    sortBy === "deadline"
                      ? "font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                  }`}
                  style={sortBy === "deadline" ? { background: "color-mix(in srgb, var(--primary-mid) 18%, transparent)", color: "var(--color-info)", fontWeight: 600 } : undefined}
                >
                  Deadline
                </button>
                <button
                  onClick={() => setSortBy("priority")}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    sortBy === "priority"
                      ? "font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                  }`}
                  style={sortBy === "priority" ? { background: "color-mix(in srgb, var(--primary-mid) 18%, transparent)", color: "var(--color-info)", fontWeight: 600 } : undefined}
                >
                  Priority
                </button>
              </div>

              <Button
                onClick={onTaskCreate}
                className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-mid)] text-white hover:shadow-neon rounded-xl h-12 font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(statusConfig).map(([key, config]) => (
              <div
                key={key}
                onClick={() =>
                  setSelectedStatus(selectedStatus === key ? null : key)
                }
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all backdrop-blur-xl ${
                  selectedStatus === key
                    ? ""
                    : "border-[var(--border)] hover:border-[var(--border-hover)]"
                }`}
                style={{
                  background: selectedStatus === key
                    ? "color-mix(in srgb, var(--primary-mid) 10%, transparent)"
                    : config.bgStyle.background,
                  borderColor: selectedStatus === key ? "var(--primary-mid)" : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      {config.label}
                    </p>
                    <p className="text-2xl font-bold" style={config.textStyle}>
                      {statusCounts[key]}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-muted)]">
                    <config.icon className="h-6 w-6" style={{ color: config.dotColor }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-[var(--bg-muted)] backdrop-blur-xl rounded-2xl border-2 border-dashed border-[var(--border)]">
              <AlertCircle className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                No tasks found
              </h3>
              <p className="text-[var(--text-secondary)]">
                {searchQuery
                  ? "Try adjusting your search criteria"
                  : "Create your first task to get started"}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const taskStatus = getTaskStatus(task);
              const statusInfo = statusConfig[taskStatus];

              return (
                <div
                  key={task._id}
                  onClick={() =>
                    setSelectedTask(selectedTask === task._id ? null : task._id)
                  }
                  className={`p-5 rounded-2xl border-l-4 transition-all cursor-pointer bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border)] hover:shadow-glass ${
                    selectedTask === task._id ? "shadow-glass" : ""
                  }`}
                  style={{ borderLeftColor: statusInfo.dotColor }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-[var(--text-secondary)] text-sm mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <Badge className={`ml-2 ${statusInfo.badgeClass}`}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-[var(--border)]">
                    <Badge style={getPriorityStyle(task.priority)}>
                      {task.priority}
                    </Badge>

                    {task.deadline && (
                      <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-muted)] px-3 py-1.5 rounded-full">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(task.deadline)}
                      </div>
                    )}

                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ color: "var(--color-info)", background: "color-mix(in srgb, var(--color-info) 10%, transparent)" }}>
                        <Tag className="h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
                        {task.tags[0]}
                      </div>
                    )}

                    <span className="text-xs text-[var(--text-secondary)] px-3 py-1.5 bg-[var(--bg-muted)] rounded-full">
                      {daysUntilDeadline(task.deadline)}
                    </span>
                  </div>

                  {task.assignedTo && task.assignedTo.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <User className="h-4 w-4 text-[var(--text-muted)]" />
                      <div className="flex gap-1">
                        {task.assignedTo.slice(0, 3).map((user, idx) => (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-white text-xs font-bold bg-avatar"
                            title={user.name || user}
                          >
                            {user.name ? user.name[0] : "U"}
                          </div>
                        ))}
                        {task.assignedTo.length > 3 && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}>
                            +{task.assignedTo.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTask === task._id && (
                    <div className="pt-2 flex gap-2 border-t border-[var(--border)]">
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: "var(--color-info)" }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {task.status !== "Completed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ color: "var(--color-success)" }}
                          onClick={() =>
                            onTaskUpdate?.(task._id, { status: "Completed" })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        style={{ color: "var(--color-danger)" }}
                        onClick={() => onTaskDelete?.(task._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
