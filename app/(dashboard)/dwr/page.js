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
  Loader2,
} from "lucide-react";

const badgeStyle = (clr) => ({
  background: `color-mix(in srgb, ${clr} 12%, transparent)`,
  color: clr,
  border: `1px solid color-mix(in srgb, ${clr} 22%, transparent)`,
});

const STATUS_STYLE = {
  Approved: { clr: "var(--color-success)" },
  Rejected:  { clr: "var(--color-danger)" },
  Pending:   { clr: "var(--color-warning)" },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
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
      setIsSubmitting(true);
      await dwrAPI.create(formData);
      setAlert({ type: "success", msg: "DWR submitted successfully!" });
      setFormData({ workSummary: "", challenges: "", nextDayPlan: "", totalHoursWorked: 8 });
      setShowForm(false);
      fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to submit DWR" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setApprovingId(id);
      await dwrAPI.approve(id, { reviewNote });
      setAlert({ type: "success", msg: "DWR approved!" });
      setReviewOpen(null); setReviewNote(""); fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to approve DWR" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!reviewNote.trim()) {
      setAlert({ type: "error", msg: "Review note required for rejection." });
      return;
    }
    try {
      setRejectingId(id);
      await dwrAPI.reject(id, { reviewNote });
      setAlert({ type: "success", msg: "DWR rejected." });
      setReviewOpen(null); setReviewNote(""); fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to reject DWR" });
    } finally {
      setRejectingId(null);
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
    if (sortField !== field) return <ChevronDown className="w-3 h-3" style={{ color: "var(--text-muted)" }} />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3" style={{ color: "var(--color-success)" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "var(--color-success)" }} />;
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
    <div className="w-full min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>

      {/* ── Page Header ── */}
      <div className="w-full backdrop-blur-xl px-6 py-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
        }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}>
              Daily Work Reports
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {activeTab === "my-dwrs"
                ? "Your submitted reports and their review status"
                : "Review and action pending reports from your team"}
            </p>
          </div>
          {activeTab === "my-dwrs" && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all duration-150"
              style={{
                background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                color: "var(--text-inverse)",
                boxShadow: "0 2px 8px color-mix(in srgb, var(--color-success) 30%, transparent)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
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
          className="mx-6 mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium border"
          style={{
            backgroundColor: "var(--bg-muted)",
            borderColor: alert.type === "error" ? "color-mix(in srgb, var(--color-danger) 30%, transparent)" : "color-mix(in srgb, var(--color-success) 30%, transparent)",
            color: alert.type === "error" ? "var(--color-danger)" : "var(--color-success)",
          }}
        >
          {alert.type === "error"
            ? <AlertCircle className="w-4 h-4 shrink-0" />
            : <BadgeCheck className="w-4 h-4 shrink-0" />}
          {alert.msg}
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="w-full px-6"
        style={{ borderBottom: "1px solid var(--border)" }}>
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
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all duration-150"
              style={{
                borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
                color: activeTab === id ? "var(--color-info)" : "var(--text-muted)",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== id) {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderBottomColor = "var(--border)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== id) {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.borderBottomColor = "transparent";
                }
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className="ml-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ backgroundColor: "var(--color-danger)" }}>
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
          <div className="w-full rounded-2xl mb-5 overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card)",
              backdropFilter: "blur(20px)",
            }}>
            <div className="px-6 py-4"
              style={{
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--bg-muted)",
              }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Submit Daily Work Report</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>For {fmt(new Date())}</p>
            </div>
            <form onSubmit={handleSubmitDWR} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: "var(--text-primary)" }}>
                  Work Summary <span className="normal-case font-normal tracking-normal"
                    style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What did you accomplish today?"
                  value={formData.workSummary}
                  onChange={(e) => setFormData({ ...formData, workSummary: e.target.value })}
                  className="input-field resize-y text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}>
                    Challenges
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any blockers or issues?"
                    value={formData.challenges}
                    onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                    className="input-field resize-y text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}>
                    Next Day Plan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What's planned for tomorrow?"
                    value={formData.nextDayPlan}
                    onChange={(e) => setFormData({ ...formData, nextDayPlan: e.target.value })}
                    className="input-field resize-y text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: "var(--text-primary)" }}>
                  Hours Worked
                </label>
                <input
                  type="number" min="0" max="24"
                  value={formData.totalHoursWorked}
                  onChange={(e) =>
                    setFormData({ ...formData, totalHoursWorked: parseFloat(e.target.value) })
                  }
                  className="input-field w-24 text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3"
                style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={isSubmitting}
                  className="btn-secondary px-4 py-2 text-sm"
                  style={{
                    opacity: isSubmitting ? 0.6 : 1,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold rounded-lg transition-colors"
                  style={{
                    background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                    color: "var(--text-inverse)",
                    boxShadow: "0 2px 8px color-mix(in srgb, var(--color-success) 30%, transparent)",
                    opacity: isSubmitting ? 0.8 : 1,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Report"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════════════
            MY DWRs TABLE
        ══════════════════════════ */}
        {activeTab === "my-dwrs" && (
          <div className="w-full rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card)",
              backdropFilter: "blur(20px)",
            }}>

            {/* Table Meta Bar */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--bg-muted)",
              }}>
              <p className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}>
                {sorted.length} Report{sorted.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-4">
                {["Approved", "Pending", "Rejected"].map((s) => {
                  const st = STATUS_STYLE[s];
                  return (
                    <span key={s} className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--text-secondary)" }}>
                      <span className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: st?.clr || "var(--text-muted)" }} />
                      {sorted.filter((d) => d.reviewStatus === s).length} {s}
                    </span>
                  );
                })}
              </div>
            </div>

            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <FileText className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No reports yet</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Click &quot;New DWR&quot; to submit your first report</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
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
                          className={`px-4 py-3 text-left whitespace-nowrap ${field ? "cursor-pointer select-none" : ""}`}
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
                    {sorted.map((dwr, i) => {
                      const st = STATUS_STYLE[dwr.reviewStatus];
                      return (
                        <Fragment key={dwr._id}>
                          <tr
                            className="table-row-hover transition-colors"
                            style={{
                              borderBottom: "1px solid var(--border)",
                              backgroundColor: expandedRow === dwr._id ? "var(--bg-muted)" : "transparent",
                            }}
                          >
                            {/* Date */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(dwr.date)}</p>
                              {dwr.isLate && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold mt-0.5"
                                  style={{ color: "var(--color-warning)" }}>
                                  <Clock className="w-2.5 h-2.5" /> Late
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={st ? badgeStyle(st.clr) : {}}
                              >
                                <span className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: st?.clr || "var(--text-muted)" }} />
                                {dwr.reviewStatus || "Pending"}
                              </span>
                            </td>

                            {/* Summary */}
                            <td className="px-4 py-3.5 max-w-sm">
                              <p className="text-sm leading-snug line-clamp-2"
                                style={{ color: "var(--text-secondary)" }}>
                                {dwr.workSummary || <span className="italic" style={{ color: "var(--text-muted)" }}>—</span>}
                              </p>
                            </td>

                            {/* Hours */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                                {dwr.totalHoursWorked}
                                <span className="text-xs font-normal ml-0.5"
                                  style={{ color: "var(--text-muted)" }}>hrs</span>
                              </span>
                            </td>

                            {/* Submitted At */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs"
                              style={{ color: "var(--text-muted)" }}>
                              {fmtTime(dwr.submittedAt)}
                            </td>

                            {/* Expand */}
                            <td className="px-4 py-3.5">
                              <button
                                onClick={() =>
                                  setExpandedRow(expandedRow === dwr._id ? null : dwr._id)
                                }
                                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors"
                                style={{
                                  color: "var(--text-muted)",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "var(--color-success)";
                                  e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-success) 8%, transparent)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "var(--text-muted)";
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
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
                            <tr key={`exp-${dwr._id}`}
                              style={{
                                backgroundColor: "var(--bg-muted)",
                                borderBottom: "1px solid var(--border)",
                              }}>
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
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                                          style={{ color: "var(--text-muted)" }}>
                                          {label}
                                        </p>
                                        <p className="text-sm leading-relaxed"
                                          style={{
                                            color: colored ? "var(--color-info)" : "var(--text-secondary)",
                                          }}>
                                          {value}
                                        </p>
                                      </div>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                      );
                    })}
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
          <div className="w-full rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card)",
              backdropFilter: "blur(20px)",
            }}>

            <div className="flex items-center justify-between px-5 py-3"
              style={{
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--bg-muted)",
              }}>
              <p className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}>
                {pendingReview.length} Pending
              </p>
              <span className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--color-warning)" }}>
                <Clock className="w-3.5 h-3.5" /> Requires your action
              </span>
            </div>

            {pendingReview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <BadgeCheck className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>All caught up!</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No pending DWRs require review</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
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
                          className="px-4 py-3 text-left whitespace-nowrap"
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
                    {pendingReview.map((dwr) => {
                      const isOpen = reviewOpen === dwr._id;
                      return (
                        <Fragment key={dwr._id}>
                          <tr
                            className="transition-colors"
                            style={{
                              borderBottom: "1px solid var(--border)",
                              borderLeft: isOpen ? `3px solid var(--color-warning)` : "3px solid transparent",
                              backgroundColor: isOpen ? "color-mix(in srgb, var(--color-warning) 6%, transparent)" : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              if (!isOpen) e.currentTarget.style.backgroundColor = "var(--bg-muted)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isOpen) e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {/* Employee */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: "color-mix(in srgb, var(--color-purple) 15%, transparent)",
                                  }}>
                                  <span className="text-xs font-bold"
                                    style={{ color: "var(--color-purple)" }}>
                                    {dwr.employee?.name
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-semibold text-sm leading-none"
                                    style={{ color: "var(--text-primary)" }}>
                                    {dwr.employee?.name}
                                  </p>
                                  <p className="text-[10px] mt-0.5"
                                    style={{ color: "var(--text-muted)" }}>
                                    {dwr.employee?.employeeId}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-xs font-medium px-2.5 py-1 rounded-md"
                                style={{
                                  color: "var(--text-muted)",
                                  backgroundColor: "var(--bg-muted)",
                                }}>
                                {dwr.employee?.department}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <p className="font-medium text-sm"
                                style={{ color: "var(--text-secondary)" }}>{fmt(dwr.date)}</p>
                              {dwr.isLate && (
                                <span className="text-[10px] font-semibold flex items-center gap-0.5 mt-0.5"
                                  style={{ color: "var(--color-warning)" }}>
                                  <Clock className="w-2.5 h-2.5" /> Late
                                </span>
                              )}
                            </td>

                            {/* Summary */}
                            <td className="px-4 py-3.5 max-w-xs">
                              <p className="text-sm line-clamp-2 leading-snug"
                                style={{ color: "var(--text-secondary)" }}>
                                {dwr.workSummary || <span className="italic" style={{ color: "var(--text-muted)" }}>—</span>}
                              </p>
                            </td>

                            {/* Hours */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                                {dwr.totalHoursWorked}
                                <span className="text-xs font-normal ml-0.5"
                                  style={{ color: "var(--text-muted)" }}>hrs</span>
                              </span>
                            </td>

                            {/* Submitted At */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs"
                              style={{ color: "var(--text-muted)" }}>
                              {fmtTime(dwr.submittedAt)}
                            </td>

                            {/* Review Toggle */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setReviewOpen(reviewOpen === dwr._id ? null : dwr._id);
                                  setReviewNote("");
                                }}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                style={isOpen
                                  ? {
                                      backgroundColor: "var(--bg-muted)",
                                      color: "var(--text-muted)",
                                    }
                                  : badgeStyle("var(--color-warning)")
                                }
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {isOpen ? "Close" : "Review"}
                              </button>
                            </td>
                          </tr>

                          {/* Inline Review Panel */}
                          {isOpen && (
                            <tr key={`rev-${dwr._id}`}
                              style={{
                                backgroundColor: "var(--bg-muted)",
                                borderBottom: "1px solid var(--border)",
                              }}>
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
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                                          style={{ color: "var(--text-muted)" }}>
                                          {label}
                                        </p>
                                        <p className="text-sm leading-relaxed"
                                          style={{ color: "var(--text-secondary)" }}>{value}</p>
                                      </div>
                                    ))}
                                </div>

                                {/* Review action area */}
                                <div className="flex items-start gap-4 pt-4"
                                  style={{ borderTop: "1px solid var(--border)" }}>
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                                      style={{ color: "var(--text-muted)" }}>
                                      Review Note{" "}
                                      <span className="normal-case font-normal tracking-normal"
                                        style={{ color: "var(--text-muted)" }}>
                                        (required for rejection)
                                      </span>
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={reviewNote}
                                      onChange={(e) => setReviewNote(e.target.value)}
                                      placeholder="Add your feedback or comments..."
                                      className="input-field resize-none text-sm"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2 pt-[22px] shrink-0">
                                    <button
                                      onClick={() => handleApprove(dwr._id)}
                                      disabled={approvingId === dwr._id}
                                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                                      style={{
                                        background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                                        color: "var(--text-inverse)",
                                        boxShadow: "0 2px 8px color-mix(in srgb, var(--color-success) 30%, transparent)",
                                        opacity: approvingId === dwr._id ? 0.6 : 1,
                                        cursor: approvingId === dwr._id ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      {approvingId === dwr._id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Approving...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleReject(dwr._id)}
                                      disabled={rejectingId === dwr._id}
                                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                                      style={{
                                        background: "linear-gradient(135deg, var(--color-danger) 0%, var(--color-danger) 100%)",
                                        color: "white",
                                        boxShadow: "0 2px 8px color-mix(in srgb, var(--color-danger) 30%, transparent)",
                                        opacity: rejectingId === dwr._id ? 0.6 : 1,
                                        cursor: rejectingId === dwr._id ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      {rejectingId === dwr._id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Rejecting...
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3.5 h-3.5" /> Reject
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => { setReviewOpen(null); setReviewNote(""); }}
                                      disabled={approvingId === dwr._id || rejectingId === dwr._id}
                                      className="btn-secondary text-xs px-4 py-2"
                                      style={{
                                        opacity: (approvingId === dwr._id || rejectingId === dwr._id) ? 0.6 : 1,
                                        cursor: (approvingId === dwr._id || rejectingId === dwr._id) ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                            </Fragment>
                      );
                    })}
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
