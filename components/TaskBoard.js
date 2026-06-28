"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Search,
  Filter,
  SortAsc,
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
      color: "bg-[#FFB84D]/10",
      badgeColor: "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
      textColor: "text-[#FFB84D]",
      dotColor: "#FFB84D",
      icon: Clock,
      count: 0,
    },
    "In Progress": {
      label: "In Progress",
      color: "bg-[#00D4FF]/10",
      badgeColor: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
      textColor: "text-[#00D4FF]",
      dotColor: "#00D4FF",
      icon: Zap,
      count: 0,
    },
    Completed: {
      label: "Completed",
      color: "bg-[#00FF88]/10",
      badgeColor: "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
      textColor: "text-[#00FF88]",
      dotColor: "#00FF88",
      icon: CheckCircle2,
      count: 0,
    },
    Overdue: {
      label: "OverDue",
      color: "bg-[#FF6B6B]/10",
      badgeColor: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
      textColor: "text-[#FF6B6B]",
      dotColor: "#FF6B6B",
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

  const getPriorityColor = (priority) => {
    const colors = {
      Critical: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25",
      High: "bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/25",
      Medium: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/25",
      Low: "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25",
    };
    return colors[priority] || "bg-white/10 text-white/60 border-white/10";
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
    <div className="w-full bg-[#0B1220] min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Task Board</h1>
          <p className="text-white/50">
            Manage and track all your tasks in one place
          </p>
        </div>

        <div className="mb-8 space-y-4 lg:space-y-0">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-white/30" />
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl bg-white/[0.05] border-white/[0.1] text-white placeholder-white/40 focus:border-[#00FF88]/50 focus:ring-[#00FF88]/30"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="rounded-xl border-white/[0.1] hover:bg-white/[0.06] h-12 text-white/70"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                {filterOpen && (
                  <div className="absolute top-full mt-2 right-0 bg-[#0F1A2E] backdrop-blur-xl rounded-xl shadow-glass border border-white/[0.08] z-10 p-3 min-w-max">
                    <button
                      onClick={() => {
                        setSelectedStatus(null);
                        setFilterOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 rounded-lg hover:bg-white/[0.06] text-white/70 font-medium"
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
                        className="block w-full text-left px-4 py-2 rounded-lg hover:bg-white/[0.06] text-white/70"
                      >
                        {config.label} ({statusCounts[key]})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
                <button
                  onClick={() => setSortBy("deadline")}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    sortBy === "deadline"
                      ? "bg-[#00FF88]/15 text-[#00FF88] font-medium"
                      : "text-white/60 hover:bg-white/[0.06]"
                  }`}
                >
                  Deadline
                </button>
                <button
                  onClick={() => setSortBy("priority")}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    sortBy === "priority"
                      ? "bg-[#00FF88]/15 text-[#00FF88] font-medium"
                      : "text-white/60 hover:bg-white/[0.06]"
                  }`}
                >
                  Priority
                </button>
              </div>

              <Button
                onClick={onTaskCreate}
                className="bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] hover:shadow-neon rounded-xl h-12 font-semibold"
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
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all bg-white/[0.04] backdrop-blur-xl ${
                  selectedStatus === key
                    ? "border-[#00FF88] bg-[#00FF88]/5"
                    : "border-white/[0.06] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/60">
                      {config.label}
                    </p>
                    <p className={`text-2xl font-bold ${config.textColor}`}>
                      {statusCounts[key]}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.05]">
                    <config.icon className="h-6 w-6" style={{ color: config.dotColor }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.04] backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/[0.08]">
              <AlertCircle className="h-12 w-12 text-white/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white/70 mb-1">
                No tasks found
              </h3>
              <p className="text-white/40">
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
                  className={`p-5 rounded-2xl border-l-4 transition-all cursor-pointer bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] hover:shadow-glass ${
                    selectedTask === task._id ? "shadow-glass" : ""
                  }`}
                  style={{ borderLeftColor: statusInfo.dotColor }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-white/50 text-sm mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <Badge className={`ml-2 ${statusInfo.badgeColor} border`}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>

                    {task.deadline && (
                      <div className="flex items-center gap-1 text-xs text-white/60 bg-white/[0.05] px-3 py-1.5 rounded-full">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(task.deadline)}
                      </div>
                    )}

                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-[#00D4FF] bg-[#00D4FF]/10 px-3 py-1.5 rounded-full">
                        <Tag className="h-3.5 w-3.5" />
                        {task.tags[0]}
                      </div>
                    )}

                    <span className="text-xs text-white/50 px-3 py-1.5 bg-white/[0.05] rounded-full">
                      {daysUntilDeadline(task.deadline)}
                    </span>
                  </div>

                  {task.assignedTo && task.assignedTo.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <User className="h-4 w-4 text-white/40" />
                      <div className="flex gap-1">
                        {task.assignedTo.slice(0, 3).map((user, idx) => (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF88] to-[#00CC70] flex items-center justify-center text-[#0B1220] text-xs font-bold"
                            title={user.name || user}
                          >
                            {user.name ? user.name[0] : "U"}
                          </div>
                        ))}
                        {task.assignedTo.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold">
                            +{task.assignedTo.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTask === task._id && (
                    <div className="pt-2 flex gap-2 border-t border-white/[0.06]">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#00D4FF] hover:bg-[#00D4FF]/10"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/60 hover:bg-white/[0.06]"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {task.status !== "Completed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#00FF88] hover:bg-[#00FF88]/10"
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
                        className="text-[#FF6B6B] hover:bg-[#FF6B6B]/10 ml-auto"
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
