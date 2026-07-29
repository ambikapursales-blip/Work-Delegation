"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { masterTaskAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  Copy,
  Eye,
  Edit,
  Filter,
  RotateCcw,
  GitBranch,
} from "lucide-react";

const TASK_TYPES = ["Daily", "Weekly", "Monthly", "Quarterly", "Half Yearly", "Yearly", "Custom"];
const STATUS_OPTIONS = ["All", "Active", "Paused"];

const statusColors = {
  Active: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400",
  Paused: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400",
  Deleted: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800 dark:text-red-400",
};

export default function MasterTasksPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [masterTasks, setMasterTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Guard against stale responses from concurrent fetches (Strict Mode, rapid filter changes)
  const fetchIdRef = useRef(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [taskTypeFilter, setTaskTypeFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchMasterTasks = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit, sortBy: "createdAt", sortOrder: -1 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (taskTypeFilter) params.taskType = taskTypeFilter;

      const res = await masterTaskAPI.getMasterTasks(params);
      if (fetchIdRef.current === fetchId) {
        setMasterTasks(res.data.masterTasks || []);
        setTotal(res.data.total || 0);
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
  }, [page, limit, search, statusFilter, taskTypeFilter]);

  useEffect(() => {
    fetchMasterTasks();
  }, [fetchMasterTasks]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);

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

  if (user?.role !== "Super Admin" && !user?.canAssignTasks) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <GitBranch className="h-16 w-16 mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">Access Denied</h2>
        <p>You do not have permission to view Master Tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Master Tasks</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Recurring schedule definitions — {total} total
          </p>
        </div>
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
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            showFilters
              ? "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)]"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Task Type</label>
              <select
                value={taskTypeFilter}
                onChange={(e) => { setTaskTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                <option value="">All Types</option>
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setSearchInput(""); setSearch(""); setStatusFilter("All"); setTaskTypeFilter(""); setPage(1); }}
                className="px-4 py-2 rounded-lg border text-sm text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                <RotateCcw className="h-4 w-4 inline mr-1" />
                Reset
              </button>
            </div>
          </div>
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
            {search || statusFilter !== "All" || taskTypeFilter
              ? "Try adjusting your filters"
              : "Create your first recurring schedule"}
          </p>
          {!search && statusFilter === "All" && !taskTypeFilter && (
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
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden lg:table-cell">Start Date</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden lg:table-cell">Assigned To</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden xl:table-cell">Last Generated</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden xl:table-cell">Next Generation</th>
                <th className="text-center px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider hidden 2xl:table-cell">Gen Count</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {masterTasks.map((mt) => (
                <tr
                  key={mt._id}
                  className="hover:bg-[var(--bg-muted)]/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/master-tasks/${mt._id}`)}
                >
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="font-medium text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-[300px]">
                        {mt.title}
                      </p>
                      {mt.description && (
                        <p className="text-xs text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-[300px] mt-0.5">
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
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] text-xs hidden lg:table-cell">
                    {formatDate(mt.startDate)}
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
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] text-xs hidden xl:table-cell">
                    {formatDateTime(mt.lastGeneratedDate)}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-secondary)] text-xs hidden xl:table-cell">
                    {formatDateTime(mt.nextGenerationDate)}
                  </td>
                  <td className="px-4 py-3.5 text-center hidden 2xl:table-cell">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{mt.generatedCount || 0}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[mt.status] || statusColors.Active}`}>
                      {mt.status === "Active" ? "Active" : mt.status === "Paused" ? "Paused" : mt.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {mt.status === "Active" ? (
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
                      ) : null}
                      <button
                        onClick={() => handleClone(mt._id)}
                        className="p-2 rounded-lg hover:bg-[#2563EB]/10 text-[#2563EB] transition-colors"
                        title="Clone"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => router.push(`/master-tasks/${mt._id}`)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mt._id, mt.title)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                        title="Delete Series"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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