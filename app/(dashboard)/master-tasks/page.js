"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { masterTaskAPI, usersAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Trash2,
  Copy,
  Eye,
  Filter,
  RotateCcw,
  GitBranch,
  X,
  Link,
} from "lucide-react";

const TASK_TYPES = ["One Time", "Daily", "Weekly", "Monthly", "Quarterly", "Half Yearly", "Yearly", "Custom"];
const STATUS_OPTIONS = ["All", "Active", "Scheduled", "Paused", "Generated"];

const CREATED_DATE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const NEXT_GEN_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "thisWeek", label: "This Week" },
  { value: "nextWeek", label: "Next Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "nextMonth", label: "Next Month" },
  { value: "none", label: "No Next Generation" },
];

const GEN_COUNT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "never", label: "Never Generated" },
  { value: "once", label: "Generated Once" },
  { value: "multiple", label: "Generated Multiple Times" },
];

const PAGE_LIMIT = 15;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name_asc", label: "Task Name A-Z" },
  { value: "name_desc", label: "Task Name Z-A" },
  { value: "nextGen_asc", label: "Next Generation Asc" },
  { value: "nextGen_desc", label: "Next Generation Desc" },
  { value: "most_gen", label: "Most Generated" },
  { value: "least_gen", label: "Least Generated" },
];

const statusColors = {
  Active: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
  Paused: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400",
  Deleted: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800 dark:text-red-400",
  Scheduled: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400",
  Completed: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800 dark:text-purple-400",
};

export default function MasterTasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isPrivileged = user?.role === "Super Admin" || user?.canAssignTasks;

  const [masterTasks, setMasterTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);

  const fetchIdRef = useRef(0);

  const [page, setPage] = useState(1);


  // Draft filters (in the panel, not yet applied)
  const defaultFilters = {
    status: "All",
    taskType: "",
    assignedTo: "",
    createdDate: "all",
    createdFrom: "",
    createdTo: "",
    nextGeneration: "all",
    nextGenFrom: "",
    nextGenTo: "",
    generatedCount: "all",
    sortBy: "newest",
  };
  const [draftFilters, setDraftFilters] = useState({ ...defaultFilters });

  // Applied filters (committed via Apply button)
  const [appliedFilters, setAppliedFilters] = useState({ ...defaultFilters });

  const [showFilters, setShowFilters] = useState(false);

  // Search is separate from the panel — debounced
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load users for the Assigned User dropdown
  useEffect(() => {
    if (user?.role === "Super Admin" || user?.canAssignTasks) {
      usersAPI.getAssignable().then((res) => {
        setUsers(res.data?.users || []);
      }).catch(() => {});
    }
  }, [user]);

  const computeDateRange = (preset, from, to) => {
    if (preset === "custom") {
      return { createdFrom: from || "", createdTo: to || "" };
    }
    const now = new Date();
    const startOfDay = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
    const endOfDay = (d) => { const r = new Date(d); r.setHours(23,59,59,999); return r; };

    switch (preset) {
      case "today": {
        const d = startOfDay(now);
        return { createdFrom: d.toISOString(), createdTo: endOfDay(now).toISOString() };
      }
      case "yesterday": {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return { createdFrom: startOfDay(y).toISOString(), createdTo: endOfDay(y).toISOString() };
      }
      case "last7": {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        return { createdFrom: startOfDay(d).toISOString(), createdTo: endOfDay(now).toISOString() };
      }
      case "last30": {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        return { createdFrom: startOfDay(d).toISOString(), createdTo: endOfDay(now).toISOString() };
      }
      case "thisMonth": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { createdFrom: startOfDay(start).toISOString(), createdTo: endOfDay(end).toISOString() };
      }
      case "lastMonth": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { createdFrom: startOfDay(start).toISOString(), createdTo: endOfDay(end).toISOString() };
      }
      default:
        return { createdFrom: "", createdTo: "" };
    }
  };

  const computeNextGenRange = (preset) => {
    const now = new Date();
    const startOfDay = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
    const endOfDay = (d) => { const r = new Date(d); r.setHours(23,59,59,999); return r; };

    const getMonday = (d) => {
      const r = new Date(d);
      const day = r.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      r.setDate(r.getDate() + diff);
      return r;
    };
    const getSunday = (d) => {
      const r = new Date(d);
      const day = r.getDay();
      const diff = day === 0 ? 0 : 7 - day;
      r.setDate(r.getDate() + diff);
      return r;
    };

    switch (preset) {
      case "today": {
        return { nextGenFrom: startOfDay(now).toISOString(), nextGenTo: endOfDay(now).toISOString() };
      }
      case "tomorrow": {
        const t = new Date(now); t.setDate(t.getDate() + 1);
        return { nextGenFrom: startOfDay(t).toISOString(), nextGenTo: endOfDay(t).toISOString() };
      }
      case "thisWeek": {
        const mon = getMonday(now);
        const sun = getSunday(now);
        return { nextGenFrom: startOfDay(mon).toISOString(), nextGenTo: endOfDay(sun).toISOString() };
      }
      case "nextWeek": {
        const nextMon = new Date(getMonday(now)); nextMon.setDate(nextMon.getDate() + 7);
        const nextSun = new Date(getSunday(now)); nextSun.setDate(nextSun.getDate() + 7);
        return { nextGenFrom: startOfDay(nextMon).toISOString(), nextGenTo: endOfDay(nextSun).toISOString() };
      }
      case "thisMonth": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { nextGenFrom: startOfDay(start).toISOString(), nextGenTo: endOfDay(end).toISOString() };
      }
      case "nextMonth": {
        const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        return { nextGenFrom: startOfDay(start).toISOString(), nextGenTo: endOfDay(end).toISOString() };
      }
      case "none":
        return { nextGeneration: "none" };
      default:
        return {};
    }
  };

  const buildParams = useCallback((f, pageNum, searchTerm) => {
    const params = { page: pageNum, limit: PAGE_LIMIT };
    if (searchTerm) params.search = searchTerm;
    if (f.status && f.status !== "All") params.status = f.status;
    if (f.taskType) params.taskType = f.taskType;
    if (f.assignedTo) params.assignedTo = f.assignedTo;
    if (f.createdDate === "custom") {
      if (f.createdFrom) params.createdFrom = f.createdFrom;
      if (f.createdTo) params.createdTo = f.createdTo;
    } else {
      const cr = computeDateRange(f.createdDate, f.createdFrom, f.createdTo);
      if (cr.createdFrom) params.createdFrom = cr.createdFrom;
      if (cr.createdTo) params.createdTo = cr.createdTo;
    }
    if (f.nextGeneration === "custom") {
      if (f.nextGenFrom) params.nextGenerationFrom = f.nextGenFrom;
      if (f.nextGenTo) params.nextGenerationTo = f.nextGenTo;
    } else {
      const ng = computeNextGenRange(f.nextGeneration);
      if (ng.nextGenFrom) params.nextGenerationFrom = ng.nextGenFrom;
      if (ng.nextGenTo) params.nextGenerationTo = ng.nextGenTo;
      if (ng.nextGeneration) params.nextGeneration = ng.nextGeneration;
    }
    if (f.generatedCount && f.generatedCount !== "all") {
      params.generatedCount = f.generatedCount;
    }
    params.sortBy = f.sortBy || "newest";
    return params;
  }, []);

  const fetchMasterTasks = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = buildParams(appliedFilters, page, search);
      const tasksRes = await masterTaskAPI.getMasterTasks(params);
      if (fetchIdRef.current === fetchId) {
        setMasterTasks(tasksRes.data.masterTasks || []);
        setTotal(tasksRes.data.total || 0);
      }
    } catch (err) {
      if (fetchIdRef.current === fetchId) {
        setError(err.response?.data?.message || "Failed to load master tasks");
        setMasterTasks([]);
      }
    } finally {
      if (fetchIdRef.current === fetchId) {
        setLoading(false);
      }
    }
  }, [page, search, appliedFilters, buildParams]);

  useEffect(() => {
    fetchMasterTasks();
  }, [fetchMasterTasks]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...draftFilters });
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    setPage(1);
    const reset = { ...defaultFilters };
    setDraftFilters(reset);
    setAppliedFilters(reset);
    setSearchInput("");
    setSearch("");
    setShowFilters(false);
  };

  const removeFilterChip = (key) => {
    const updated = { ...appliedFilters };
    if (key === "status") { updated.status = defaultFilters.status; }
    else if (key === "taskType") { updated.taskType = defaultFilters.taskType; }
    else if (key === "assignedTo") { updated.assignedTo = defaultFilters.assignedTo; }
    else if (key === "createdDate") {
      updated.createdDate = defaultFilters.createdDate;
      updated.createdFrom = "";
      updated.createdTo = "";
    } else if (key === "nextGeneration") {
      updated.nextGeneration = defaultFilters.nextGeneration;
      updated.nextGenFrom = "";
      updated.nextGenTo = "";
    } else if (key === "generatedCount") { updated.generatedCount = defaultFilters.generatedCount; }
    else if (key === "sortBy") { updated.sortBy = defaultFilters.sortBy; }
    setAppliedFilters(updated);
    setPage(1);
  };

  const activeChips = useMemo(() => {
    const chips = [];
    if (appliedFilters.status !== "All") chips.push({ key: "status", label: `Status: ${appliedFilters.status}` });
    if (appliedFilters.taskType) chips.push({ key: "taskType", label: `Type: ${appliedFilters.taskType}` });
    if (appliedFilters.assignedTo) {
      const u = users.find((u) => u._id === appliedFilters.assignedTo);
      chips.push({ key: "assignedTo", label: `User: ${u?.name || appliedFilters.assignedTo}` });
    }
    if (appliedFilters.createdDate !== "all") {
      const opt = CREATED_DATE_OPTIONS.find((o) => o.value === appliedFilters.createdDate);
      chips.push({ key: "createdDate", label: `Created: ${opt?.label || appliedFilters.createdDate}` });
    }
    if (appliedFilters.nextGeneration !== "all") {
      const opt = NEXT_GEN_OPTIONS.find((o) => o.value === appliedFilters.nextGeneration);
      chips.push({ key: "nextGeneration", label: `Next Gen: ${opt?.label || appliedFilters.nextGeneration}` });
    }
    if (appliedFilters.generatedCount !== "all") {
      const opt = GEN_COUNT_OPTIONS.find((o) => o.value === appliedFilters.generatedCount);
      chips.push({ key: "generatedCount", label: `Gen Count: ${opt?.label || appliedFilters.generatedCount}` });
    }
    if (appliedFilters.sortBy !== "newest") {
      const opt = SORT_OPTIONS.find((o) => o.value === appliedFilters.sortBy);
      chips.push({ key: "sortBy", label: `Sort: ${opt?.label || appliedFilters.sortBy}` });
    }
    return chips;
  }, [appliedFilters, users]);

  const totalPages = useMemo(() => Math.ceil(total / PAGE_LIMIT), [total]);

  const handlePause = async (id) => {
    try {
      await masterTaskAPI.pauseMasterTask(id);
      fetchMasterTasks();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to pause");
    }
  };

  const handleResume = async (id) => {
    try {
      await masterTaskAPI.resumeMasterTask(id);
      fetchMasterTasks();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to resume");
    }
  };

  const handleClone = async (id) => {
    try {
      await masterTaskAPI.cloneMasterTask(id);
      fetchMasterTasks();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to clone");
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete recurring series "${title}"?\n\nThis will:\n- Stop future task generation\n- Stop reminder emails\n- Stop notifications\n- Delete recurring schedule\n\nCompleted history will remain.`)) {
      return;
    }
    try {
      await masterTaskAPI.deleteMasterTask(id);
      fetchMasterTasks();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete");
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Master Tasks</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Recurring schedule definitions — {total} total{activeChips.length > 0 ? " (filtered)" : ""}
          </p>
        </div>
        {isPrivileged && (
          <button
            onClick={() => router.push("/master-tasks/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
              boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
            }}
          >
            <Plus className="h-4 w-4" />
            New Master Task
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search master tasks..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all shrink-0 ${
            showFilters
              ? "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeChips.length > 0 && (
            <span className="ml-1 h-5 w-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">
              {activeChips.length}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Status</label>
              <select
                value={draftFilters.status}
                onChange={(e) => setDraftFilters((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Task Type */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Task Type</label>
              <select
                value={draftFilters.taskType}
                onChange={(e) => setDraftFilters((p) => ({ ...p, taskType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                <option value="">All Types</option>
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Assigned User — management-only filter (exposes other users) */}
            {isPrivileged && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Assigned User</label>
                <select
                  value={draftFilters.assignedTo}
                  onChange={(e) => setDraftFilters((p) => ({ ...p, assignedTo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                >
                  <option value="">All Users</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Sort By</label>
              <select
                value={draftFilters.sortBy}
                onChange={(e) => setDraftFilters((p) => ({ ...p, sortBy: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Created Date */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Created Date</label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={draftFilters.createdDate}
                onChange={(e) => setDraftFilters((p) => ({ ...p, createdDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {CREATED_DATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {draftFilters.createdDate === "custom" && (
                <>
                  <input type="date" value={draftFilters.createdFrom}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, createdFrom: e.target.value }))}
                    className="px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
                  <input type="date" value={draftFilters.createdTo}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, createdTo: e.target.value }))}
                    className="px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
                </>
              )}
            </div>
          </div>

          {/* Next Generation */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Next Generation</label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={draftFilters.nextGeneration}
                onChange={(e) => setDraftFilters((p) => ({ ...p, nextGeneration: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {NEXT_GEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {draftFilters.nextGeneration === "custom" && (
                <>
                  <input type="date" value={draftFilters.nextGenFrom}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, nextGenFrom: e.target.value }))}
                    className="px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
                  <input type="date" value={draftFilters.nextGenTo}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, nextGenTo: e.target.value }))}
                    className="px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]" />
                </>
              )}
            </div>
          </div>

          {/* Generation Count */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Generation Count</label>
            <select
              value={draftFilters.generatedCount}
              onChange={(e) => setDraftFilters((p) => ({ ...p, generatedCount: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] max-w-xs"
            >
              {GEN_COUNT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Apply / Reset Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Filters
            </button>
            <button
              onClick={handleApplyFilters}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)" }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20"
            >
              {chip.label}
              <button onClick={() => removeFilterChip(chip.key)} className="hover:bg-[#2563EB]/20 rounded-full p-0.5 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={handleResetFilters}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
          <button onClick={fetchMasterTasks} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && masterTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
          <GitBranch className="h-16 w-16 mb-4 opacity-30" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">No Master Tasks Found</h3>
          <p className="text-sm mb-6">
            {search || activeChips.length > 0
              ? "Try adjusting your filters"
              : "Create your first recurring schedule"}
          </p>
          {isPrivileged && !search && activeChips.length === 0 && (
            <button
              onClick={() => router.push("/master-tasks/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
              }}
            >
              <Plus className="h-4 w-4" />
              Create Master Task
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && !error && masterTasks.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">Task Name</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden lg:table-cell">Assigned To</th>
                <th className="text-center px-2 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden sm:table-cell">Gen</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden xl:table-cell">Next Generation</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">Attachment</th>
                <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {masterTasks.map((mt) => {
                const ops = mt.operationalStats || {};
                return (
                <tr
                  key={mt._id}
                  className="hover:bg-[var(--bg-muted)]/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/master-tasks/${mt._id}`)}
                >
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="font-medium text-[var(--text-primary)] truncate max-w-[180px] sm:max-w-[250px]">
                        {mt.title}
                      </p>
                      {mt.description && (
                        <p className="text-xs text-[var(--text-muted)] truncate max-w-[180px] sm:max-w-[250px] mt-0.5">
                          {mt.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] hidden md:table-cell">
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-[var(--bg-muted)] border border-[var(--border)]">
                      {mt.taskType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex -space-x-2">
                      {(mt.assignedTo || []).slice(0, 3).map((a) => (
                        <div
                          key={a._id}
                          className="h-7 w-7 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--bg-card)]"
                          title={a.name}
                        >
                          {a.name?.charAt(0)?.toUpperCase()}
                        </div>
                      ))}
                      {(mt.assignedTo || []).length > 3 && (
                        <div className="h-7 w-7 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)] ring-2 ring-[var(--bg-card)]">
                          +{mt.assignedTo.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3.5 text-center hidden sm:table-cell">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {ops.totalGenerated || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] text-xs hidden xl:table-cell">
                    {formatDateTime(mt.nextGenerationDate)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[mt.status] || statusColors.Active}`}>
                      {mt.status === "Completed" ? "Generated" : mt.status === "Active" ? "Active" : mt.status === "Paused" ? "Paused" : mt.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {mt.attachmentUrl ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(mt.attachmentUrl, "_blank", "noopener,noreferrer");
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#2563EB] hover:bg-[#2563EB]/10 transition-colors"
                        title="View Attachment"
                      >
                        <Link className="h-3.5 w-3.5" />
                        Attachment
                      </button>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {isPrivileged && (mt.status === "Active" ? (
                        <button
                          onClick={() => handlePause(mt._id)}
                          className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-600 transition-colors"
                          title="Pause"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : mt.status === "Paused" ? (
                        <button
                          onClick={() => handleResume(mt._id)}
                          className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-600 transition-colors"
                          title="Resume"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      ) : null)}
                      {isPrivileged && (
                        <button
                          onClick={() => handleClone(mt._id)}
                          className="p-2 rounded-lg hover:bg-[#2563EB]/10 text-[#2563EB] transition-colors"
                          title="Clone"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/master-tasks/${mt._id}`)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {isPrivileged && (
                        <button
                          onClick={() => handleDelete(mt._id, mt.title)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                          title="Delete Series"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-[var(--text-secondary)]">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}