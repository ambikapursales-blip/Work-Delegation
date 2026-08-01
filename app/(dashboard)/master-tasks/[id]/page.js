"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { masterTaskAPI, usersAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Copy,
  Trash2,
  Edit3,
  Clock,
  Users,
  Tag,
  Calendar,
  Activity,
  Zap,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const statusColors = {
  Active: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
  Paused: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400",
  Deleted: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800 dark:text-red-400",
  Scheduled: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400",
  Completed: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800 dark:text-slate-400",
};

const toDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split("T")[0].split("-");
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
};
const toDateStr = (date) => {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function MasterTaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const isPrivileged = user?.role === "Super Admin" || user?.canAssignTasks;

  const [masterTask, setMasterTask] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [occurrencesTotal, setOccurrencesTotal] = useState(0);
  const [occurrenceFilter, setOccurrenceFilter] = useState("all");
  const [occurrencePage, setOccurrencePage] = useState(1);
  const occurrenceLimit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit form
  const [form, setForm] = useState({});
  const [users, setUsers] = useState([]);

  const fetchMasterTask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel API calls — eliminates waterfall
      const [res, histRes] = await Promise.all([
        masterTaskAPI.getMasterTask(params.id),
        masterTaskAPI.getMasterTaskHistory(params.id, {
          page: occurrencePage,
          limit: occurrenceLimit,
          status: occurrenceFilter === "all" ? undefined : occurrenceFilter,
        }),
      ]);

      const task = res.data.masterTask;
      setMasterTask(task);
      setForm({
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "Medium",
        category: task.category || "General",
        department: task.department || "",
        tags: (task.tags || []).join(", "),
        scheduledHour: task.scheduledHour || 9,
        scheduledMinute: task.scheduledMinute || 0,
        startDate: task.startDate ? task.startDate.split("T")[0] : "",
        repeatForever: task.repeatForever ?? true,
        recurrenceEndDate: task.endDate ? task.endDate.split("T")[0] : "",
        defaultDeadlineHours: task.defaultDeadlineHours || "",
        deadline: task.deadline ? task.deadline.split("T")[0] : "",
        attachmentUrl: task.attachmentUrl || "",
      });

      setOccurrences(histRes.data.occurrences || []);
      setOccurrencesTotal(histRes.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load master task");
    } finally {
      setLoading(false);
    }
  }, [params.id, occurrencePage, occurrenceFilter]);

  useEffect(() => {
    fetchMasterTask();
  }, [fetchMasterTask]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await usersAPI.getAssignable();
        setUsers(res.data.users || res.data || []);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    if (editing) fetchUsers();
  }, [editing]);

  const handlePause = async () => {
    try {
      await masterTaskAPI.pauseMasterTask(params.id);
      fetchMasterTask();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to pause");
    }
  };

  const handleResume = async () => {
    try {
      await masterTaskAPI.resumeMasterTask(params.id);
      fetchMasterTask();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to resume");
    }
  };

  const handleGenerateNow = async () => {
    try {
      await masterTaskAPI.generateNow(params.id);
      fetchMasterTask();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to generate task");
    }
  };

  const handleClone = async () => {
    try {
      await masterTaskAPI.cloneMasterTask(params.id);
      router.push("/master-tasks");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to clone");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete recurring series "${masterTask.title}"?\n\nThis will stop future generation, reminders, and notifications. Completed history will remain.`)) {
      return;
    }
    try {
      await masterTaskAPI.deleteMasterTask(params.id);
      router.push("/master-tasks");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isOneTime = masterTask.taskType === "One Time";
      const payload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category,
        department: form.department,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        startDate: form.startDate,
        attachmentUrl: form.attachmentUrl ? form.attachmentUrl.trim() : null,
      };
      if (isOneTime) {
        payload.deadline = form.deadline || null;
      } else {
        payload.scheduledHour = parseInt(form.scheduledHour);
        payload.scheduledMinute = parseInt(form.scheduledMinute);
        payload.repeatForever = form.repeatForever;
        payload.endDate = form.repeatForever ? null : form.recurrenceEndDate || null;
        payload.defaultDeadlineHours = form.defaultDeadlineHours ? parseInt(form.defaultDeadlineHours) : null;
      }
      await masterTaskAPI.updateMasterTask(params.id, payload);
      setEditing(false);
      fetchMasterTask();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => router.push("/master-tasks")} className="text-[#2563EB] underline">Back to Master Tasks</button>
      </div>
    );
  }

  if (!masterTask) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <p className="text-lg mb-4">Master task not found</p>
        <button onClick={() => router.push("/master-tasks")} className="text-[#2563EB] underline">Back to Master Tasks</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/master-tasks")}
            className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{masterTask.title}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[masterTask.status] || statusColors.Active}`}>
                {masterTask.status}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {masterTask.taskType === "One Time" ? "One-time task template" : `${masterTask.taskType} recurring schedule`}
            </p>
          </div>
        </div>

        {isPrivileged && (
          <div className="flex items-center gap-2">
            {masterTask.status === "Active" ? (
              <button onClick={handlePause} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-600 text-sm font-medium hover:bg-amber-500/10 transition-colors">
                <Pause className="h-4 w-4" /> Pause
              </button>
            ) : masterTask.status === "Paused" ? (
              <button onClick={handleResume} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-600 text-sm font-medium hover:bg-emerald-500/10 transition-colors">
                <Play className="h-4 w-4" /> Resume
              </button>
            ) : masterTask.status === "Scheduled" ? (
              <button onClick={handleGenerateNow} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-600 text-sm font-medium hover:bg-blue-500/10 transition-colors">
                <Zap className="h-4 w-4" /> Generate Now
              </button>
            ) : masterTask.status === "Generated" ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm">
                <Zap className="h-4 w-4" /> Generated
              </span>
            ) : null}
            <button onClick={handleClone} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-muted)] transition-colors">
              <Copy className="h-4 w-4" /> Clone
            </button>
            <button
              onClick={() => setEditing(!editing)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)" }}
            >
              <Edit3 className="h-4 w-4" /> {editing ? "Cancel" : "Edit"}
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{masterTask.taskType === "One Time" ? "Deadline" : "Next Generation"}</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
            {masterTask.taskType === "One Time" ? formatDate(masterTask.deadline) : formatDateTime(masterTask.nextGenerationDate)}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Last Generated</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{formatDateTime(masterTask.lastGeneratedDate)}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Generation Count</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{masterTask.generatedCount || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Start Date</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{formatDate(masterTask.startDate)}</p>
        </div>
      </div>

      {/* Edit Mode or Details */}
      {editing ? (
        <form onSubmit={handleUpdate} className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Edit Master Task</h2>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Attachment URL (Optional)</label>
            <input type="url" value={form.attachmentUrl} onChange={(e) => setForm((p) => ({ ...p, attachmentUrl: e.target.value }))}
              placeholder="https://example.com/document.pdf"
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
            <p className="text-xs text-[var(--text-muted)] mt-1">Enter a valid HTTP/HTTPS URL for attachment</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]">
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]">
                {["Sales", "HR", "Operations", "Customer Support", "Admin", "General", "Marketing", "Strategic"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
            <DatePicker
              selected={toDate(form.startDate)}
              onChange={(date) => setForm((p) => ({ ...p, startDate: toDateStr(date) }))}
              dateFormat="dd MMM yyyy"
              placeholderText="Select start date"
              className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] cursor-pointer"
              wrapperClassName="w-full"
              popperClassName="react-datepicker-dark"
              calendarClassName="react-datepicker-dark-calendar"
              showPopperArrow={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Scheduled Hour</label>
              <input type="number" min="0" max="23" value={form.scheduledHour} onChange={(e) => setForm((p) => ({ ...p, scheduledHour: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Scheduled Minute</label>
              <input type="number" min="0" max="59" value={form.scheduledMinute} onChange={(e) => setForm((p) => ({ ...p, scheduledMinute: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.repeatForever} onChange={(e) => setForm((p) => ({ ...p, repeatForever: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)] text-[#2563EB]" />
              <span className="text-sm text-[var(--text-primary)]">Repeat Forever</span>
            </label>
          </div>
          {!form.repeatForever && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">End Date</label>
              <DatePicker
                selected={toDate(form.recurrenceEndDate)}
                onChange={(date) => setForm((p) => ({ ...p, recurrenceEndDate: toDateStr(date) }))}
                dateFormat="dd MMM yyyy"
                placeholderText="No end date"
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] cursor-pointer"
                wrapperClassName="w-full"
                popperClassName="react-datepicker-dark"
                calendarClassName="react-datepicker-dark-calendar"
                isClearable
                showPopperArrow={false}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)" }}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Task Type</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{masterTask.taskType}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Priority</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{masterTask.priority}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Category</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{masterTask.category || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Department</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{masterTask.department || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Start Date</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(masterTask.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Schedule Time</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {String(masterTask.scheduledHour).padStart(2, "0")}:{String(masterTask.scheduledMinute).padStart(2, "0")} IST
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Repeat Forever</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{masterTask.repeatForever ? "Yes" : "No"}</p>
            </div>
            {masterTask.endDate && (
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">End Date</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(masterTask.endDate)}</p>
              </div>
            )}
            {masterTask.createdBy && (
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Created By</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{masterTask.createdBy?.name || "—"}</p>
              </div>
            )}
          </div>

          {masterTask.description && (
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{masterTask.description}</p>
            </div>
          )}

          {masterTask.tags && masterTask.tags.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {masterTask.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Assigned Users</p>
            <div className="flex flex-wrap gap-2">
              {(masterTask.assignedTo || []).map((a) => (
                <div key={a._id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)]">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-[9px] font-bold text-white">
                    {a.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Occurrence History */}
      <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Generated Occurrences</h2>
          <div className="flex items-center gap-3">
            <select
              value={occurrenceFilter}
              onChange={(e) => { setOccurrenceFilter(e.target.value); setOccurrencePage(1); }}
              className="input-field text-xs py-1.5 px-2 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>
            <p className="text-xs text-[var(--text-muted)]">{occurrencesTotal} total</p>
          </div>
        </div>
        {occurrences.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            {masterTask.taskType === "One Time"
              ? masterTask.status === "Scheduled"
                ? 'This one-time task is ready to generate. Click "Generate Now" to create the task.'
                : "No generated tasks found for this one-time master task."
              : `No occurrences generated yet. Generated occurrences will appear here once they start. Scheduled to begin ${formatDate(masterTask.startDate)}.`}
          </p>
        ) : (
          <div className="space-y-2">
            {occurrences.map((occ) => (
              <div key={occ._id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] hover:bg-[var(--bg-muted)]/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/tasks/${occ._id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[var(--bg-muted)] flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{occ.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">Occurrence #{occ.occurrenceNumber} — {formatDate(occ.occurrenceDate)}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  occ.status === "Completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800"
                  : occ.status === "Overdue" ? "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800"
                  : "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800"
                }`}>
                  {occ.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {occurrencesTotal > occurrenceLimit && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)]">
              Showing {(occurrencePage - 1) * occurrenceLimit + 1}&ndash;{Math.min(occurrencePage * occurrenceLimit, occurrencesTotal)} of {occurrencesTotal}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOccurrencePage((p) => Math.max(1, p - 1))}
                disabled={occurrencePage === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setOccurrencePage((p) => p + 1)}
                disabled={occurrencePage * occurrenceLimit >= occurrencesTotal}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone — management-only */}
      {isPrivileged && (
        <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
          <p className="text-sm text-red-500/80 dark:text-red-400/80 mb-4">
            Deleting this master task will stop all future generations, reminders, and notifications. Completed history will be preserved.
          </p>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Recurring Series
          </button>
        </div>
      )}
    </div>
  );
}