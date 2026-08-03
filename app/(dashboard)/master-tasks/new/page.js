"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { masterTaskAPI, usersAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Loader2 } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const TASK_TYPES = [
  { value: "One Time", label: "One Time" },
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Half Yearly", label: "Half Yearly" },
  { value: "Yearly", label: "Yearly" },
  { value: "Custom", label: "Custom" },
];

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const CATEGORIES = ["General", "Sales", "Service", "Spare Parts", "Marketing", "CRM", "HR", "Accounts & Finance", "Purchase", "Stores", "Logistics", "Admin", "IT", "Management"];
const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];
const INTERVAL_UNITS = ["Minutes", "Hours", "Days", "Weeks", "Months"];

const toDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split("T")[0].split("-");
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
};
const toDateStr = (date) => {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function NewMasterTaskPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    taskType: "One Time",
    category: "General",
    assignedTo: [],
    tags: "",
    department: "",
    startDate: todayStr,
    scheduledHour: 9,
    scheduledMinute: 0,
    repeatForever: true,
    recurrenceEndDate: "",
    defaultDeadlineHours: "",
    deadline: "",
    attachmentUrl: "",
  });

  const [recurrencePattern, setRecurrencePattern] = useState({
    frequency: "daily",
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: 1,
    intervalValue: 1,
    intervalUnit: "Days",
    customDays: [],
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await usersAPI.getAssignable();
        setUsers(res.data.users || res.data || []);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const freqMap = {
      Daily: "daily",
      Weekly: "weekly",
      Monthly: "monthly",
      Quarterly: "quarterly",
      "Half Yearly": "halfyearly",
      Yearly: "yearly",
      Custom: "custom",
    };
    setRecurrencePattern((prev) => ({
      ...prev,
      frequency: freqMap[form.taskType] || "daily",
    }));
  }, [form.taskType]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAssignee = (userId) => {
    setForm((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter((id) => id !== userId)
        : [...prev.assignedTo, userId],
    }));
  };

  const toggleWeekDay = (day) => {
    setRecurrencePattern((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (form.assignedTo.length === 0) {
      setError("Please assign at least one user");
      return;
    }
    if (form.taskType === "Weekly" && recurrencePattern.daysOfWeek.length === 0) {
      setError("Please select at least one day of the week");
      return;
    }
    if (!form.startDate) {
      setError("Start date is required");
      return;
    }

    const isOneTime = form.taskType === "One Time";
    if (isOneTime && !form.deadline) {
      setError("Deadline is required for one-time master tasks");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        taskType: form.taskType,
        category: form.category,
        assignedTo: form.assignedTo,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        department: form.department,
        startDate: form.startDate,
        scheduledHour: parseInt(form.scheduledHour),
        scheduledMinute: parseInt(form.scheduledMinute),
        repeatForever: isOneTime ? false : form.repeatForever,
        recurrenceEndDate: isOneTime ? null : (form.repeatForever ? null : form.recurrenceEndDate || null),
        defaultDeadlineHours: isOneTime ? null : (form.defaultDeadlineHours ? parseInt(form.defaultDeadlineHours) : null),
        deadline: isOneTime ? form.deadline : undefined,
        attachmentUrl: form.attachmentUrl ? form.attachmentUrl.trim() : null,
      };

      if (!isOneTime) {
        payload.recurrencePattern = {
          frequency: recurrencePattern.frequency,
          interval: recurrencePattern.interval,
          daysOfWeek: recurrencePattern.daysOfWeek,
          dayOfMonth: recurrencePattern.dayOfMonth,
          intervalValue: recurrencePattern.intervalValue,
          intervalUnit: recurrencePattern.intervalUnit,
        };
      }

      await masterTaskAPI.createMasterTask(payload);
      router.push("/master-tasks");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create master task");
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.role !== "Super Admin" && !user?.canAssignTasks) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <p className="text-lg">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/master-tasks")}
          className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Master Task</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Create a recurring schedule definition</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="Enter task title"
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Enter description"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Attachment URL (Optional)</label>
            <input
              type="url"
              value={form.attachmentUrl}
              onChange={(e) => updateForm("attachmentUrl", e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Enter a valid HTTP/HTTPS URL for attachment</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => updateForm("priority", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateForm("category", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
                placeholder="e.g. Sales"
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => updateForm("tags", e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full px-4 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Schedule</h2>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Start Date *</label>
            <DatePicker
              selected={toDate(form.startDate)}
              onChange={(date) => updateForm("startDate", toDateStr(date))}
              dateFormat="dd MMM yyyy"
              placeholderText="Select start date"
              className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] cursor-pointer"
              wrapperClassName="w-full"
              popperClassName="react-datepicker-dark"
              calendarClassName="react-datepicker-dark-calendar"
              showPopperArrow={false}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Task Type *</label>
              <select
                value={form.taskType}
                onChange={(e) => updateForm("taskType", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Deadline for One Time */}
            {form.taskType === "One Time" ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Deadline *</label>
                <DatePicker
                  selected={toDate(form.deadline)}
                  onChange={(date) => updateForm("deadline", toDateStr(date))}
                  dateFormat="dd MMM yyyy"
                  placeholderText="Select deadline"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)] cursor-pointer"
                  wrapperClassName="w-full"
                  popperClassName="react-datepicker-dark"
                  calendarClassName="react-datepicker-dark-calendar"
                  showPopperArrow={false}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Interval</label>
                <input
                  type="number"
                  min="1"
                  value={recurrencePattern.interval}
                  onChange={(e) => setRecurrencePattern((prev) => ({ ...prev, interval: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>
            )}
          </div>

          {/* Weekly Days (recurring only) */}
          {form.taskType === "Weekly" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Days of Week</label>
              <div className="flex gap-2">
                {WEEKDAYS.map((wd) => (
                  <button
                    key={wd.value}
                    type="button"
                    onClick={() => toggleWeekDay(wd.value)}
                    className={`h-10 w-10 rounded-lg text-xs font-medium border transition-all ${
                      recurrencePattern.daysOfWeek.includes(wd.value)
                        ? "bg-[#2563EB] text-white border-[#2563EB]"
                        : "bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[#2563EB]/50"
                    }`}
                  >
                    {wd.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Date (recurring only) */}
          {form.taskType === "Monthly" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={recurrencePattern.dayOfMonth}
                onChange={(e) => setRecurrencePattern((prev) => ({ ...prev, dayOfMonth: parseInt(e.target.value) || 1 }))}
                className="w-24 px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
              />
            </div>
          )}

          {/* Custom Interval (recurring only) */}
          {form.taskType === "Custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Interval Value</label>
                <input
                  type="number"
                  min="1"
                  value={recurrencePattern.intervalValue}
                  onChange={(e) => setRecurrencePattern((prev) => ({ ...prev, intervalValue: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Interval Unit</label>
                <select
                  value={recurrencePattern.intervalUnit}
                  onChange={(e) => setRecurrencePattern((prev) => ({ ...prev, intervalUnit: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                >
                  {INTERVAL_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Scheduled Time + Deadline Hours (recurring only) */}
          {form.taskType !== "One Time" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={form.scheduledHour}
                    onChange={(e) => updateForm("scheduledHour", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Minute (0-59)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={form.scheduledMinute}
                    onChange={(e) => updateForm("scheduledMinute", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Deadline Hours</label>
                  <input
                    type="number"
                    min="0"
                    value={form.defaultDeadlineHours}
                    onChange={(e) => updateForm("defaultDeadlineHours", e.target.value)}
                    placeholder="Auto-calculated"
                    className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-base)] text-[var(--text-primary)] border-[var(--border)]"
                  />
                </div>
              </div>

              {/* Repeat Forever / End Date */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.repeatForever}
                    onChange={(e) => updateForm("repeatForever", e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">Repeat Forever</span>
                </label>
                {!form.repeatForever && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">End Date</label>
                    <DatePicker
                      selected={toDate(form.recurrenceEndDate)}
                      onChange={(date) => updateForm("recurrenceEndDate", toDateStr(date))}
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
          </div>
              </>
          )}
        </div>

        {/* Assign Users */}
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Assigned Users *</h2>
          {users.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Loading users...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
              {users.map((u) => (
                <label
                  key={u._id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    form.assignedTo.includes(u._id)
                      ? "bg-[#2563EB]/10 border-[#2563EB]/30 text-[var(--text-primary)]"
                      : "bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#2563EB]/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.assignedTo.includes(u._id)}
                    onChange={() => toggleAssignee(u._id)}
                    className="h-4 w-4 rounded border-[var(--border)] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white">
                      {u.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-sm">{u.name}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
          {form.assignedTo.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">{form.assignedTo.length} user(s) selected</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.push("/master-tasks")}
            className="px-6 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
              boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Master Task"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}