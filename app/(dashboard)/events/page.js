"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAuth } from "@/lib/auth-context";
import { eventsAPI, usersAPI, api } from "@/lib/api";
import { SkeletonTable } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import Toast from "@/components/Toast";
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";


const STATUS_STYLE = {
  Upcoming: { clr: "var(--color-info)" },
  Ongoing: { clr: "var(--color-success)" },
  Completed: { clr: "var(--text-muted)" },
  Cancelled: { clr: "var(--color-danger)" },
};

const STATUS_DOT = {
  Upcoming: { background: "var(--color-info)" },
  Ongoing: { background: "var(--color-success)" },
  Completed: { background: "var(--text-muted)" },
  Cancelled: { background: "var(--color-danger)" },
};

const RSVP_STYLE = {
  Pending: { clr: "var(--color-warning)" },
  Accepted: { clr: "var(--color-success)" },
  Declined: { clr: "var(--color-danger)" },
  Attended: { clr: "var(--color-info)" },
  Absent: { clr: "var(--text-muted)" },
};

const badgeStyle = (clr) => ({
  background: `color-mix(in srgb, ${clr} 12%, transparent)`,
  color: clr,
  border: `1px solid color-mix(in srgb, ${clr} 22%, transparent)`,
});

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [alert, setAlert] = useState(null);
  const [sortField, setSortField] = useState("startDate");
  const [sortDir, setSortDir] = useState("asc");
  const [hoverEl, setHoverEl] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rsvpingEventId, setRsvpingEventId] = useState(null);
  const [completingEventId, setCompletingEventId] = useState(null);
  const canManage = user?.role === "Super Admin" || user?.canAssignTasks;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Meeting",
    startDate: "",
    endDate: "",
    location: "",
    isVirtual: false,
    meetingLink: "",
    assignedTo: [],
    priority: "Medium",
    tags: [],
  });

  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(null), 3500);
      return () => clearTimeout(t);
    }
  }, [alert]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsRes, usersRes] = await Promise.all([
        eventsAPI.getAll(),
        user?.role === "Super Admin" || user?.canViewAllTasks
          ? usersAPI.getAll()
          : Promise.resolve({ data: { users: [] } }),
      ]);
      setEvents(eventsRes.data?.events || []);
      setUsers(usersRes.data?.users || []);
    } catch {
      setAlert({ type: "error", msg: "Failed to fetch data" });
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.canViewAllTasks]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startDate || !formData.endDate) {
      setAlert({
        type: "error",
        msg: "Title, start date, and end date are required",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingEvent) {
        await eventsAPI.update(editingEvent._id, formData);
        setAlert({ type: "success", msg: "Event updated successfully!" });
      } else {
        await eventsAPI.create(formData);
        setAlert({ type: "success", msg: "Event created successfully!" });
      }
      resetForm();
      fetchData();
    } catch (error) {
      setAlert({ type: "error", msg: "Failed to save event" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      setDeletingEventId(id);
      await eventsAPI.delete(id);
      setAlert({ type: "success", msg: "Event deleted successfully!" });
      fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to delete event" });
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleSelectEvent = (eventId) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEvents.length === sorted.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(sorted.map(event => event._id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedEvents.length} event(s)?`)) return;
    
    try {
      setBulkDeleting(true);
      await Promise.all(selectedEvents.map(id => eventsAPI.delete(id)));
      setAlert({ type: "success", msg: `${selectedEvents.length} event(s) deleted successfully!` });
      setSelectedEvents([]);
      fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to delete some events" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleRSVP = async (eventId, status) => {
    try {
      setRsvpingEventId(eventId);
      await api.put(`/events/${eventId}/rsvp`, { status });
      setAlert({ type: "success", msg: "RSVP updated!" });
      fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to update RSVP" });
    } finally {
      setRsvpingEventId(null);
    }
  };

  const handleMarkComplete = async (eventId) => {
    try {
      setCompletingEventId(eventId);
      await eventsAPI.update(eventId, { status: "Completed" });
      setAlert({ type: "success", msg: "Event marked as completed!" });
      fetchData();
    } catch {
      setAlert({ type: "error", msg: "Failed to mark event as completed" });
    } finally {
      setCompletingEventId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "Meeting",
      startDate: "",
      endDate: "",
      location: "",
      isVirtual: false,
      meetingLink: "",
      assignedTo: [],
      priority: "Medium",
      tags: [],
    });
    setEditingEvent(null);
    setShowForm(false);
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field)
      return <ChevronDown className="w-3 h-3" style={{ color: "var(--text-muted)" }} />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" style={{ color: "var(--color-success)" }} />
    ) : (
      <ChevronDown className="w-3 h-3" style={{ color: "var(--color-success)" }} />
    );
  };

  const getPriorityStyle = (priority) => {
    const map = {
      High: "var(--color-danger)",
      Medium: "var(--color-warning)",
      Low: "var(--color-success)",
    };
    return badgeStyle(map[priority] || "var(--text-muted)");
  };

  const actionBtnStyle = (hoverClr, isHover) => ({
    padding: "0.375rem",
    borderRadius: "0.375rem",
    color: isHover ? hoverClr : "var(--text-muted)",
    background: isHover ? `color-mix(in srgb, ${hoverClr} 10%, transparent)` : "transparent",
    border: "none",
    cursor: "pointer",
    transition: "color 0.2s ease, background 0.2s ease",
  });

  const sorted = [...events].sort((a, b) => {
    let av = a[sortField],
      bv = b[sortField];
    if (sortField === "startDate" || sortField === "endDate") {
      av = new Date(av);
      bv = new Date(bv);
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const fmtDateTime = (d) =>
    new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) return <SkeletonTable rows={6} cols={4} />;

  return (
    <div className="w-full min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div
        className="w-full backdrop-blur-xl px-4 sm:px-6 py-3 sm:py-4"
        style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Events
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Manage organizational events and RSVPs
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-create-task gap-2 w-full sm:w-auto justify-center"
              style={{ color: "var(--active-text)" }}
            >
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          )}
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <Toast
          type={alert.type}
          message={alert.msg}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="w-full px-4 sm:px-6 py-4 sm:py-5">
        {/* Event Form */}
        {showForm && (
          <div
            className="w-full backdrop-blur-xl rounded-2xl mb-5 overflow-hidden shadow-glass-sm"
            style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}
            >
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Event Title <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter event title"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Event Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Training">Training</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Conference">Conference</option>
                    <option value="Team Building">Team Building</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Start Date <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    End Date <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="input-field"
                    placeholder="Physical location (if not virtual)"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isVirtual"
                    checked={formData.isVirtual}
                    onChange={(e) =>
                      setFormData({ ...formData, isVirtual: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                    style={{ borderColor: "var(--text-muted)", accentColor: "var(--color-success)" }}
                  />
                  <label htmlFor="isVirtual" className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Virtual Event
                  </label>
                </div>
                {formData.isVirtual && (
                  <div className="col-span-1 sm:col-span-2">
                    <label
                      className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Meeting Link
                    </label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          meetingLink: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                )}
                <div className="col-span-1 sm:col-span-2">
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="input-field"
                    placeholder="Event description and agenda..."
                  />
                </div>
                {canManage && (
                  <div className="col-span-1 sm:col-span-2">
                    <label
                      className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Assign To
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {users.map((u) => (
                        <label
                          key={u._id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                          style={{ background: "var(--bg-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "color-mix(in srgb, white 4%, var(--bg-muted))")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "var(--bg-muted)")
                          }
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
                            className="w-4 h-4 rounded"
                            style={{ borderColor: "var(--text-muted)", accentColor: "var(--color-success)" }}
                          />
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {u.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div
                className="flex flex-col sm:flex-row gap-2 justify-end pt-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="btn-secondary w-full sm:w-auto"
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
                  className="btn-create-task px-5 py-2 text-sm font-semibold rounded-lg w-full sm:w-auto"
                  style={{
                    border: "none",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.8 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-shimmer inline-block rounded-full w-3.5 h-3.5 shrink-0" style={{background:"linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",backgroundSize:"200% 100%"}} />
                      {editingEvent ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingEvent ? "Update Event" : "Create Event"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Events Table */}
        <div
          className="backdrop-blur-xl rounded-2xl shadow-glass-sm overflow-hidden"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Events Overview
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Showing {sorted.length} events
              </p>
            </div>
            {selectedEvents.length > 0 && canManage && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                  color: "var(--color-danger)",
                  border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
                  opacity: bulkDeleting ? 0.6 : 1,
                  cursor: bulkDeleting ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!bulkDeleting) {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 20%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!bulkDeleting) {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 12%, transparent)";
                  }
                }}
              >
                {bulkDeleting ? (
                  <>
                    <span className="animate-shimmer inline-block rounded-full w-3.5 h-3.5 shrink-0" style={{background:"linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",backgroundSize:"200% 100%"}} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedEvents.length} Event{selectedEvents.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nodata.gif"
                alt="No data"
                className="w-32 h-32 object-contain"
              />
              <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
                No events found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head w-10">
                        <input
                          type="checkbox"
                          checked={selectedEvents.length === sorted.length && sorted.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ borderColor: "var(--text-muted)", accentColor: "var(--color-success)" }}
                        />
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head">
                        Event
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head hidden md:table-cell">
                        Type
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head">
                        Start Date
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head">
                        Status
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head hidden sm:table-cell">
                        Priority
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head hidden md:table-cell">
                        Attendees
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left table-head">
                        Actions
                      </th>
                    </tr>
                </thead>
                <tbody>
                  {sorted.map((event) => (
                    <tr
                      key={event._id}
                      className="table-row-hover"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event._id)}
                          onChange={() => handleSelectEvent(event._id)}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ borderColor: "var(--text-muted)", accentColor: "var(--color-success)" }}
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 max-w-xs">
                        <div>
                          <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                            {event.title}
                          </p>
                          {event.description && (
                            <p className="text-xs mt-0.5 line-clamp-1 truncate" style={{ color: "var(--text-secondary)" }}>
                              {event.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-md"
                          style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
                        >
                          {event.type}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {fmtDateTime(event.startDate)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={badgeStyle(STATUS_STYLE[event.status]?.clr || "var(--text-muted)")}
                        >
                          {event.status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={getPriorityStyle(event.priority)}
                        >
                          {event.priority}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          {event.assignedTo && event.assignedTo.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {event.assignedTo
                                .slice(0, 2)
                                .map((user, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs font-medium px-2 py-1 rounded-md"
                                    style={badgeStyle("var(--color-purple)")}
                                    title={
                                      typeof user === "object"
                                        ? user.name
                                        : user
                                    }
                                  >
                                    {typeof user === "object"
                                      ? user.name
                                      : user}
                                  </span>
                                ))}
                              {event.assignedTo.length > 2 && (
                                <span
                                  className="text-xs font-medium px-2 py-1 rounded-md"
                                  style={{ color: "var(--text-secondary)", background: "var(--bg-muted)" }}
                                >
                                  +{event.assignedTo.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              No attendees
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-1">
                          {event.status !== "Completed" && (
                            <button
                              onClick={() => handleMarkComplete(event._id)}
                              disabled={completingEventId === event._id}
                              style={{
                                ...actionBtnStyle("var(--color-success)", hoverEl === "complete-" + event._id),
                                opacity: completingEventId === event._id ? 0.6 : 1,
                                cursor: completingEventId === event._id ? "not-allowed" : "pointer",
                              }}
                              onMouseEnter={() => {
                                if (completingEventId !== event._id) {
                                  setHoverEl("complete-" + event._id);
                                }
                              }}
                              onMouseLeave={() => setHoverEl(null)}
                              title="Mark as completed"
                            >
                              {completingEventId === event._id ? (
                                <span className="animate-shimmer inline-block rounded-full w-3.5 h-3.5" style={{background:"linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",backgroundSize:"200% 100%"}} />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingEvent(event);
                                  setFormData(event);
                                  setShowForm(true);
                                }}
                                style={actionBtnStyle("var(--color-info)", hoverEl === "edit-" + event._id)}
                                onMouseEnter={() => setHoverEl("edit-" + event._id)}
                                onMouseLeave={() => setHoverEl(null)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(event._id)}
                                disabled={deletingEventId === event._id}
                                style={{
                                  ...actionBtnStyle("var(--color-danger)", hoverEl === "delete-" + event._id),
                                  opacity: deletingEventId === event._id ? 0.6 : 1,
                                  cursor: deletingEventId === event._id ? "not-allowed" : "pointer",
                                }}
                                onMouseEnter={() => {
                                  if (deletingEventId !== event._id) {
                                    setHoverEl("delete-" + event._id);
                                  }
                                }}
                                onMouseLeave={() => setHoverEl(null)}
                              >
                                {deletingEventId === event._id ? (
                                  <span className="animate-shimmer inline-block rounded-full w-3.5 h-3.5" style={{background:"linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%)",backgroundSize:"200% 100%"}} />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
