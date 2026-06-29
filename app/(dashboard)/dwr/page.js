"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAuth } from "@/lib/auth-context";
import { dwrAPI } from "@/lib/api";
import { Loading } from "@/components/loading";
import {
  Plus,
  FileText,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Timer,
  User,
  Building2,
  BadgeCheck,
  AlertCircle,
} from "lucide-react";

const STATUS_STYLES = {
  Approved: "bg-[#00FF88]/15 text-[#00FF88] ring-1 ring-[#00FF88]/25",
  Rejected:  "bg-[#FF6B6B]/15 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/25",
  Pending:   "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25",
};

const STATUS_DOT = {
  Approved: "bg-[#00FF88]",
  Rejected:  "bg-[#FF6B6B]",
  Pending:   "bg-[#FFB84D]",
};

export default function DWRPage() {
  const { user } = useAuth();
  const [dwrs, setDwrs] = useState([]);
  const [pendingReview, setPendingReview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("my-dwrs");
  const [expandedRow, setExpandedRow] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [alert, setAlert] = useState(null);
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [formData, setFormData] = useState({
    workSummary: "",
    challenges: "",
    nextDayPlan: "",
    totalHoursWorked: 8,
  });

  const canReview = ["Admin", "Manager", "HR"].includes(user?.role);

  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(null), 3500);
      return () => clearTimeout(t);
    }
  }, [alert]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === "my-dwrs") {
        const res = await dwrAPI.getAll();
        setDwrs(res.data?.dwrs || []);
      } else if (canReview) {
        const res = await dwrAPI.getPendingReview();
        setPendingReview(res.data?.dwrs || []);
      }
    } catch {
      setAlert({ type: "error", msg: "Failed to fetch DWRs" });
    } finally {
      setLoading(false);
    }
  }, [activeTab, canReview]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitDWR = async (e) => {
    e.preventDefault();
    if (!formData.workSummary.trim()) {
      setAlert({ type: "error", msg: "Work summary is required." });
      return;
    }
    try {
      await dwrAPI.create(formData);
      setAlert({ type: "success", msg: "DWR submitted successfully!" });
      setFormData({ workSummary: "", challenges: "", nextDayPlan: "", totalHoursWorked: 8 });
      setShowForm(false);
      fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to submit DWR" });
    }
  };

  const handleApprove = async (id) => {
    try {
      await dwrAPI.approve(id, { reviewNote });
      setAlert({ type: "success", msg: "DWR approved!" });
      setReviewOpen(null); setReviewNote(""); fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to approve DWR" });
    }
  };

  const handleReject = async (id) => {
    if (!reviewNote.trim()) {
      setAlert({ type: "error", msg: "Review note required for rejection." });
      return;
    }
    try {
      await dwrAPI.reject(id, { reviewNote });
      setAlert({ type: "success", msg: "DWR rejected." });
      setReviewOpen(null); setReviewNote(""); fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to reject DWR" });
    }
  };

  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-white/30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-[#00FF88]" />
      : <ChevronDown className="w-3 h-3 text-[#00FF88]" />;
  };

  const sorted = [...dwrs].sort((a, b) => {
    let av = a[sortField], bv = b[sortField];
    if (sortField === "date") { av = new Date(av); bv = new Date(bv); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  if (loading) return <Loading />;

  return (
    <div className="w-full min-h-screen bg-[#0B1220]">

      {/* ── Page Header ── */}
      <div className="w-full bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white/85 tracking-tight">
              Daily Work Reports
            </h1>
            <p className="text-sm text-white/50 mt-0.5">
              {activeTab === "my-dwrs"
                ? "Your submitted reports and their review status"
                : "Review and action pending reports from your team"}
            </p>
          </div>
          {activeTab === "my-dwrs" && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] hover:opacity-90 active:scale-95 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              New DWR
            </button>
          )}
        </div>
      </div>

      {/* ── Alert ── */}
      {alert && (
        <div
          className={`mx-6 mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
            alert.type === "error"
              ? "bg-white/[0.04] backdrop-blur-xl border-red-500/30 text-red-400"
              : "bg-white/[0.04] backdrop-blur-xl border-[#00FF88]/30 text-[#00FF88]"
          }`}
        >
          {alert.type === "error"
            ? <AlertCircle className="w-4 h-4 shrink-0" />
            : <BadgeCheck className="w-4 h-4 shrink-0" />}
          {alert.msg}
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="w-full bg-white/[0.02] border-b border-white/[0.06] px-6">
        <div className="flex">
          {[
            { id: "my-dwrs",        icon: FileText, label: "My DWRs",        count: null },
            ...(canReview
              ? [{ id: "pending-review", icon: Eye, label: "Pending Review", count: pendingReview.length }]
              : []),
          ].map(({ id, icon: Icon, label, count }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setShowForm(false);
                setExpandedRow(null);
                setReviewOpen(null);
              }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-150 ${
                activeTab === id
                  ? "border-[#00FF88] text-[#00FF88]"
                  : "border-transparent text-white/50 hover:text-white/70 hover:border-white/[0.1]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className="ml-1 bg-[#FF6B6B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-6 py-5">

        {/* ── Submission Form ── */}
        {activeTab === "my-dwrs" && showForm && (
          <div className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl mb-5 overflow-hidden shadow-glass-sm">
            <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <h2 className="text-base font-bold text-white/85">Submit Daily Work Report</h2>
              <p className="text-xs text-white/50 mt-0.5">For {fmt(new Date())}</p>
            </div>
            <form onSubmit={handleSubmitDWR} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 font-medium uppercase tracking-wide mb-1.5">
                  Work Summary <span className="text-red-400 normal-case font-normal tracking-normal">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What did you accomplish today?"
                  value={formData.workSummary}
                  onChange={(e) => setFormData({ ...formData, workSummary: e.target.value })}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-[#00FF88] focus:bg-white/[0.08] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/80 font-medium uppercase tracking-wide mb-1.5">
                    Challenges
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any blockers or issues?"
                    value={formData.challenges}
                    onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-[#00FF88] focus:bg-white/[0.08] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 font-medium uppercase tracking-wide mb-1.5">
                    Next Day Plan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What's planned for tomorrow?"
                    value={formData.nextDayPlan}
                    onChange={(e) => setFormData({ ...formData, nextDayPlan: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-[#00FF88] focus:bg-white/[0.08] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/80 font-medium uppercase tracking-wide mb-1.5">
                  Hours Worked
                </label>
                <input
                  type="number" min="0" max="24"
                  value={formData.totalHoursWorked}
                  onChange={(e) =>
                    setFormData({ ...formData, totalHoursWorked: parseFloat(e.target.value) })
                  }
                  className="w-24 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF88] focus:bg-white/[0.08] transition-colors"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-white/50 border border-white/[0.1] rounded-lg hover:bg-white/[0.06] hover:text-white/70 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] hover:opacity-90 rounded-lg transition-colors"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════════════
            MY DWRs TABLE
        ══════════════════════════ */}
        {activeTab === "my-dwrs" && (
          <div className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm overflow-hidden">

            {/* Table Meta Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                {sorted.length} Report{sorted.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-4">
                {["Approved", "Pending", "Rejected"].map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                    {sorted.filter((d) => d.reviewStatus === s).length} {s}
                  </span>
                ))}
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <FileText className="w-10 h-10 text-white/20" />
                <p className="text-sm font-medium text-white/50">No reports yet</p>
                <p className="text-xs text-white/30">Click &quot;New DWR&quot; to submit your first report</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      {[
                        { field: "date",             label: "Date",         icon: CalendarDays },
                        { field: "reviewStatus",      label: "Status",       icon: BadgeCheck },
                        { field: "workSummary",       label: "Work Summary", icon: FileText },
                        { field: "totalHoursWorked",  label: "Hours",        icon: Timer },
                        { field: "submittedAt",       label: "Submitted At", icon: Clock },
                        { field: null,                label: "",             icon: null },
                      ].map(({ field, label, icon: Icon }) => (
                        <th
                          key={label}
                          onClick={() => field && toggleSort(field)}
                          className={`px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide whitespace-nowrap ${
                            field ? "cursor-pointer select-none hover:text-white/60" : ""
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            {label}
                            {field && <SortIcon field={field} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((dwr, i) => (
                      <Fragment key={dwr._id}>
                        <tr
                          className={`border-b border-white/[0.04] transition-colors ${
                            expandedRow === dwr._id
                              ? "bg-white/[0.04]"
                              : "hover:bg-white/[0.02]"
                          }`}
                        >
                          {/* Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-white/85">{fmt(dwr.date)}</p>
                            {dwr.isLate && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400 mt-0.5">
                                <Clock className="w-2.5 h-2.5" /> Late
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[dwr.reviewStatus]}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[dwr.reviewStatus]}`} />
                              {dwr.reviewStatus}
                            </span>
                          </td>

                          {/* Summary */}
                          <td className="px-4 py-3.5 max-w-sm">
                            <p className="text-white/60 text-sm leading-snug line-clamp-2">
                              {dwr.workSummary || <span className="text-white/30 italic">—</span>}
                            </p>
                          </td>

                          {/* Hours */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-semibold text-white/70">
                              {dwr.totalHoursWorked}
                              <span className="text-xs font-normal text-white/40 ml-0.5">hrs</span>
                            </span>
                          </td>

                          {/* Submitted At */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-white/40">
                            {fmtTime(dwr.submittedAt)}
                          </td>

                          {/* Expand */}
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() =>
                                setExpandedRow(expandedRow === dwr._id ? null : dwr._id)
                              }
                              className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-[#00FF88] px-2.5 py-1.5 rounded-md hover:bg-[#00FF88]/10 transition-colors"
                            >
                              {expandedRow === dwr._id ? (
                                <><ChevronUp className="w-3.5 h-3.5" /> Hide</>
                              ) : (
                                <><ChevronDown className="w-3.5 h-3.5" /> Details</>
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Row */}
                        {expandedRow === dwr._id && (
                          <tr key={`exp-${dwr._id}`} className="bg-white/[0.02] border-b border-white/[0.04]">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid grid-cols-3 gap-6">
                                {[
                                  { label: "Challenges",    value: dwr.challenges },
                                  { label: "Next Day Plan", value: dwr.nextDayPlan },
                                  { label: "Review Note",   value: dwr.reviewNote, colored: true },
                                ]
                                  .filter((f) => f.value)
                                  .map(({ label, value, colored }) => (
                                    <div key={label}>
                                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                                        {label}
                                      </p>
                                      <p className={`text-sm leading-relaxed ${colored ? "text-[#00D4FF]" : "text-white/60"}`}>
                                        {value}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════
            PENDING REVIEW TABLE
        ══════════════════════════ */}
        {activeTab === "pending-review" && (
          <div className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm overflow-hidden">

            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                {pendingReview.length} Pending
              </p>
              <span className="flex items-center gap-1 text-xs text-[#FFB84D] font-medium">
                <Clock className="w-3.5 h-3.5" /> Requires your action
              </span>
            </div>

            {pendingReview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <BadgeCheck className="w-10 h-10 text-white/20" />
                <p className="text-sm font-medium text-white/50">All caught up!</p>
                <p className="text-xs text-white/30">No pending DWRs require review</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      {[
                        { label: "Employee",     icon: User },
                        { label: "Department",   icon: Building2 },
                        { label: "Date",         icon: CalendarDays },
                        { label: "Work Summary", icon: FileText },
                        { label: "Hours",        icon: Timer },
                        { label: "Submitted At", icon: Clock },
                        { label: "Action",       icon: null },
                      ].map(({ label, icon: Icon }) => (
                        <th
                          key={label}
                          className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide whitespace-nowrap"
                        >
                          <span className="flex items-center gap-1.5">
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            {label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReview.map((dwr) => (
                      <Fragment key={dwr._id}>
                        <tr
                          className={`border-b border-white/[0.04] border-l-2 transition-colors ${
                            reviewOpen === dwr._id
                              ? "bg-[#FFB84D]/10 border-l-[#FFB84D]"
                              : "hover:bg-white/[0.02] border-l-transparent"
                          }`}
                        >
                          {/* Employee */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#B366FF]/20 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-[#B366FF]">
                                  {dwr.employee?.name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-semibold text-white/85 text-sm leading-none">
                                  {dwr.employee?.name}
                                </p>
                                <p className="text-[10px] text-white/40 mt-0.5">
                                  {dwr.employee?.employeeId}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-xs font-medium bg-white/[0.08] text-white/60 px-2.5 py-1 rounded-md">
                              {dwr.employee?.department}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-medium text-white/70 text-sm">{fmt(dwr.date)}</p>
                            {dwr.isLate && (
                              <span className="text-[10px] text-orange-400 font-semibold flex items-center gap-0.5 mt-0.5">
                                <Clock className="w-2.5 h-2.5" /> Late
                              </span>
                            )}
                          </td>

                          {/* Summary */}
                          <td className="px-4 py-3.5 max-w-xs">
                            <p className="text-white/60 text-sm line-clamp-2 leading-snug">
                              {dwr.workSummary || <span className="text-white/30 italic">—</span>}
                            </p>
                          </td>

                          {/* Hours */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-semibold text-white/70">
                              {dwr.totalHoursWorked}
                              <span className="text-xs font-normal text-white/40 ml-0.5">hrs</span>
                            </span>
                          </td>

                          {/* Submitted At */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-white/40">
                            {fmtTime(dwr.submittedAt)}
                          </td>

                          {/* Review Toggle */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setReviewOpen(reviewOpen === dwr._id ? null : dwr._id);
                                setReviewNote("");
                              }}
                              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                reviewOpen === dwr._id
                                  ? "bg-white/[0.1] text-white/60"
                                  : "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25 hover:bg-[#FFB84D]/25"
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {reviewOpen === dwr._id ? "Close" : "Review"}
                            </button>
                          </td>
                        </tr>

                        {/* Inline Review Panel */}
                        {reviewOpen === dwr._id && (
                          <tr key={`rev-${dwr._id}`} className="bg-white/[0.02] border-b border-white/[0.04]">
                            <td colSpan={7} className="px-6 py-5">
                              {/* Detail grid */}
                              <div className="grid grid-cols-3 gap-5 mb-5">
                                {[
                                  { label: "Work Summary", value: dwr.workSummary },
                                  { label: "Challenges",   value: dwr.challenges },
                                  { label: "Next Day Plan",value: dwr.nextDayPlan },
                                ]
                                  .filter((f) => f.value)
                                  .map(({ label, value }) => (
                                    <div key={label}>
                                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                                        {label}
                                      </p>
                                      <p className="text-sm text-white/60 leading-relaxed">{value}</p>
                                    </div>
                                  ))}
                              </div>

                              {/* Review action area */}
                              <div className="flex items-start gap-4 pt-4 border-t border-white/[0.06]">
                                <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                                    Review Note{" "}
                                    <span className="normal-case font-normal tracking-normal text-white/30">
                                      (required for rejection)
                                    </span>
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={reviewNote}
                                    onChange={(e) => setReviewNote(e.target.value)}
                                    placeholder="Add your feedback or comments..."
                                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#00FF88] transition-colors"
                                  />
                                </div>
                                <div className="flex flex-col gap-2 pt-[22px] shrink-0">
                                  <button
                                    onClick={() => handleApprove(dwr._id)}
                                    className="flex items-center gap-1.5 bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] hover:opacity-90 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(dwr._id)}
                                    className="flex items-center gap-1.5 bg-[#FF6B6B] hover:bg-[#e55a5a] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                  </button>
                                  <button
                                    onClick={() => { setReviewOpen(null); setReviewNote(""); }}
                                    className="text-xs font-medium text-white/50 hover:text-white/70 px-4 py-2 rounded-lg border border-white/[0.1] hover:bg-white/[0.06] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                          </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}