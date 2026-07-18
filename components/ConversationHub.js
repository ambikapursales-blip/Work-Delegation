"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useAuth } from "@/lib/auth-context";
import { conversationAPI, taskAPI } from "@/lib/api";
import {
  MessageSquare,
  Send,
  Paperclip,
  ChevronRight,
  ChevronDown,
  Check,
  Clock,
  User,
  Trash2,
  Edit3,
  X,
  Loader2,
  ArrowLeft,
  Calendar,
  Flag,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Bell,
} from "lucide-react";
import ActionCenter from "@/components/ActionCenter";

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtFullDate(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLE = {
  Completed: "var(--color-success)",
  "In Progress": "var(--color-info)",
  Overdue: "var(--color-danger)",
  Cancelled: "var(--text-muted)",
  "On Hold": "var(--color-warning)",
};

const PRIORITY_STYLE = {
  Critical: "var(--color-danger)",
  High: "var(--color-warning)",
  Medium: "var(--color-info)",
  Low: "var(--color-success)",
};

function badgeStyle(color) {
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
  };
}

function TaskHeader({ task, loading, user, onBack, isMobile }) {
  if (loading) {
    return (
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
        <Loader2 className="w-4 h-4" style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      </div>
    );
  }
  if (!task) return null;

  const statusColor = STATUS_STYLE[task.status] || "var(--text-muted)";
  const priorityColor = PRIORITY_STYLE[task.priority] || "var(--text-muted)";
  const now = new Date();
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const createdDate = task.createdAt ? new Date(task.createdAt) : null;
  
  let remainingText = "";
  let remainingColor = "var(--text-muted)";
  let remainingIcon = null;
  
  if (deadlineDate) {
    const diff = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
    if (task.status === "Completed") {
      remainingText = "Completed";
      remainingColor = "var(--color-success)";
      remainingIcon = "✅";
    } else if (diff < 0) {
      remainingText = `${Math.abs(diff)} Days Overdue`;
      remainingColor = "var(--color-danger)";
      remainingIcon = "🔴";
    } else if (diff === 0) {
      remainingText = "Due Today";
      remainingColor = "var(--color-danger)";
      remainingIcon = "🟠";
    } else {
      remainingText = `${diff} Days Left`;
      remainingColor = diff <= 3 ? "var(--color-warning)" : "var(--color-success)";
      remainingIcon = diff <= 3 ? "🟡" : "🟢";
    }
  }

  const assignedToNames = Array.isArray(task.assignedTo)
    ? task.assignedTo.map((u) => u.name || "User").join(", ")
    : "Unassigned";

  const cardStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
  };

  const labelStyle = {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  };

  const valueStyle = {
    fontSize: "13px",
    color: "var(--text-primary)",
    fontWeight: 500,
  };

  const gridItemStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  };

  return (
    <div
      style={{
        padding: "16px 20px 0",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        flexShrink: 0,
        ...(isMobile ? { maxHeight: "35vh", overflowY: "auto" } : {}),
      }}
    >
      <button
        onClick={onBack}
        className="mobile-back-btn"
        style={{ padding: "6px", borderRadius: "8px", border: "none", background: "var(--bg-muted)", color: "var(--text-secondary)", cursor: "pointer", display: isMobile ? "inline-flex" : "none", flexShrink: 0, lineHeight: 0, marginBottom: "8px", position: isMobile ? "sticky" : "static", top: 0, zIndex: 1 }}
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div style={cardStyle}>
        {/* Top Row: Title and Badges */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "0 0 8px 0",
                lineHeight: 1.3,
              }}
            >
              {task.title}
            </h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={badgeStyle(statusColor)}>{task.status}</span>
              <span style={badgeStyle(priorityColor)}>{task.priority}</span>
            </div>
          </div>
        </div>

        {/* Second Row: Grid Layout for Task Details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px 24px",
            marginBottom: "16px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={gridItemStyle}>
            <span style={labelStyle}>Task</span>
            <span style={valueStyle}>{task.title}</span>
          </div>

          <div style={gridItemStyle}>
            <span style={labelStyle}>Assigned To</span>
            <span style={valueStyle}>{assignedToNames}</span>
          </div>

          <div style={gridItemStyle}>
            <span style={labelStyle}>Assigned By</span>
            <span style={valueStyle}>{task.assignedBy?.name || "Unknown"}</span>
          </div>

          {createdDate && (
            <div style={gridItemStyle}>
              <span style={labelStyle}>Created</span>
              <span style={valueStyle}>{fmtFullDate(createdDate)}</span>
            </div>
          )}

          {deadlineDate && (
            <div style={gridItemStyle}>
              <span style={labelStyle}>Deadline</span>
              <span style={valueStyle}>{fmtFullDate(deadlineDate)}</span>
            </div>
          )}

          {task.category && (
            <div style={gridItemStyle}>
              <span style={labelStyle}>Category</span>
              <span style={valueStyle}>{task.category}</span>
            </div>
          )}

          {deadlineDate && (
            <div style={gridItemStyle}>
              <span style={labelStyle}>Remaining</span>
              <span
                style={{
                  ...valueStyle,
                  color: remainingColor,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {remainingIcon && <span>{remainingIcon}</span>}
                {remainingText}
              </span>
            </div>
          )}

          {task.taskType && (
            <div style={gridItemStyle}>
              <span style={labelStyle}>Task Type</span>
              <span style={valueStyle}>{task.taskType}</span>
            </div>
          )}
        </div>


        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {task.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-primary)",
                    textDecoration: "none",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 15%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 10%, transparent)";
                  }}
                >
                  <Paperclip className="w-4 h-4" />
                  {att.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ message, isOwn, onEdit, onDelete }) {
  const [showActions, setShowActions] = useState(false);

  const typeStyles = {
    text: { bg: "var(--bg-surface)", border: "1px solid var(--border)" },
    system: {
      bg: "color-mix(in srgb, var(--color-info) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-info) 15%, transparent)",
      fontStyle: "italic",
    },
    status_change: {
      bg: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-warning) 15%, transparent)",
    },
    deadline_extend: {
      bg: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)",
    },
    file_upload: {
      bg: "color-mix(in srgb, var(--color-success) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-success) 15%, transparent)",
    },
    task_completed: {
      bg: "color-mix(in srgb, var(--color-success) 15%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
    },
    task_assigned: {
      bg: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)",
    },
    task_reopened: {
      bg: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-warning) 15%, transparent)",
    },
    extension_requested: {
      bg: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)",
    },
    extension_approved: {
      bg: "color-mix(in srgb, var(--color-success) 10%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)",
    },
    extension_rejected: {
      bg: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)",
    },
    task_accepted: {
      bg: "color-mix(in srgb, var(--color-success) 10%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)",
    },
    task_rejected: {
      bg: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)",
    },
    priority_changed: {
      bg: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-warning) 15%, transparent)",
    },
    assignee_changed: {
      bg: "color-mix(in srgb, var(--color-info) 8%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--color-info) 15%, transparent)",
    },
  };
  const style = typeStyles[message.type] || typeStyles.text;

  const systemTypes = [
    "system",
    "status_change",
    "deadline_extend",
    "file_upload",
    "task_completed",
    "task_assigned",
    "task_reopened",
    "extension_requested",
    "extension_approved",
    "extension_rejected",
    "task_accepted",
    "task_rejected",
    "priority_changed",
    "assignee_changed",
  ];

  const systemIcon = (type) => {
    switch (type) {
      case "status_change":
        return <Clock className="w-3 h-3" />;
      case "task_completed":
        return (
          <Check
            className="w-3 h-3"
            style={{ color: "var(--color-success)" }}
          />
        );
      case "task_assigned":
        return <User className="w-3 h-3" />;
      case "file_upload":
        return <Paperclip className="w-3 h-3" />;
      case "task_reopened":
        return (
          <RotateCcw
            className="w-3 h-3"
            style={{ color: "var(--color-warning)" }}
          />
        );
      case "extension_requested":
        return (
          <AlertCircle
            className="w-3 h-3"
            style={{ color: "var(--color-danger)" }}
          />
        );
      case "extension_approved":
        return (
          <ThumbsUp
            className="w-3 h-3"
            style={{ color: "var(--color-success)" }}
          />
        );
      case "extension_rejected":
        return (
          <ThumbsDown
            className="w-3 h-3"
            style={{ color: "var(--color-danger)" }}
          />
        );
      case "task_accepted":
        return (
          <Check
            className="w-3 h-3"
            style={{ color: "var(--color-success)" }}
          />
        );
      case "task_rejected":
        return (
          <X className="w-3 h-3" style={{ color: "var(--color-danger)" }} />
        );
      case "priority_changed":
        return (
          <Flag className="w-3 h-3" style={{ color: "var(--color-warning)" }} />
        );
      case "assignee_changed":
        return <User className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div
      id={`msg-${message._id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOwn ? "flex-end" : "flex-start",
        marginBottom: "8px",
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {message.type === "text" && !message.isDeleted && (
        <div style={{ maxWidth: "60%", minWidth: "100px", display: "flex", gap: "8px", alignItems: "flex-end" }}>
          {!isOwn && (
            <div style={{ flexShrink: 0 }}>
              {message.sender?.avatar ? (
                <img
                  src={message.sender.avatar}
                  alt=""
                  style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "var(--bg-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  {(message.sender?.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!isOwn && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "2px",
                  paddingLeft: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {message.sender?.name || "Unknown"}
                </span>
              </div>
            )}
            <div
              style={{
                padding: "10px 16px",
                borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                ...style,
                position: "relative",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {message.text}
              </p>
              {message.isEdited && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                    display: "block",
                  }}
                >
                  (edited)
                </span>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isOwn ? "flex-end" : "flex-start",
                  gap: "4px",
                  marginTop: "2px",
                }}
              >
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  {fmtTime(message.createdAt)}
                </span>
              </div>
            </div>
          </div>
          {showActions && isOwn && (
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginTop: "4px",
                padding: "0 4px",
              }}
            >
              <button
                onClick={() => onEdit?.(message)}
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "none",
                  background: "var(--bg-muted)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete?.(message._id)}
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "none",
                  background:
                    "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                  color: "var(--color-danger)",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {message.isDeleted && (
        <div
          style={{
            maxWidth: "60%",
            padding: "6px 14px",
            borderRadius: "12px",
            background: "var(--bg-muted)",
            opacity: 0.5,
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            This message was deleted
          </p>
        </div>
      )}

      {!message.isDeleted && systemTypes.includes(message.type) && (
        <div style={{ width: "100%", textAlign: "center", padding: "8px 0" }}>
          {message.type === "task_completed" || message.type === "extension_requested" ? (
            <div
              style={{
                maxWidth: "85%",
                margin: "0 auto",
                padding: "20px 24px",
                borderRadius: "16px",
                ...style,
                fontSize: "14px",
                color: "var(--text-primary)",
                textAlign: "left",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                position: "relative",
              }}
            >
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "10px", 
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: `1px solid ${style.border.replace('1px solid ', '')}`
              }}>
                <div style={{ 
                  fontSize: "24px",
                  lineHeight: 1
                }}>
                  {message.type === "task_completed" ? "✅" : "🕒"}
                </div>
                <span style={{ 
                  fontWeight: 800, 
                  fontSize: "15px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: message.type === "task_completed" ? "var(--color-success)" : "var(--color-danger)"
                }}>
                  {message.type === "task_completed" ? "Task Completed" : "Revised Target Date Requested"}
                </span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{message.text}</div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "16px",
                  display: "block",
                  textAlign: "right",
                  fontWeight: 500,
                }}
              >
                {fmtTime(message.createdAt)}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 14px",
                borderRadius: "20px",
                ...style,
                fontSize: "11px",
                color: "var(--text-secondary)",
              }}
            >
              {systemIcon(message.type)}
              {message.text}
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  marginLeft: "4px",
                }}
              >
                {fmtTime(message.createdAt)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function MessageInput({ onSend, loading, onCompleteTask, onRequestExtension }) {
  const [text, setText] = useState("");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "8px",
        padding: "12px 20px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
        flexShrink: 0,
        alignItems: "flex-end",
        position: "relative",
      }}
    >
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowActionMenu(!showActionMenu)}
          style={{
            padding: "8px",
            border: "none",
            background: showActionMenu ? "var(--bg-muted)" : "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            flexShrink: 0,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {showActionMenu && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              marginBottom: "8px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              padding: "8px",
              minWidth: "200px",
              zIndex: 100,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowActionMenu(false);
                onCompleteTask();
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "none",
                background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                color: "var(--color-success)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-success) 20%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-success) 15%, transparent)";
              }}
            >
              <CheckCircle className="w-4 h-4" />
              Complete Task
            </button>
            <button
              type="button"
              onClick={() => {
                setShowActionMenu(false);
                onRequestExtension();
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "none",
                background: "color-mix(in srgb, var(--color-danger) 15%, transparent)",
                color: "var(--color-danger)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background 0.15s",
                textAlign: "left",
                marginTop: "4px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 20%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 15%, transparent)";
              }}
            >
              <Clock className="w-4 h-4" />
              Request Revised Target Date
            </button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "6px" }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: "22px",
            border: "1px solid var(--border)",
            background: "var(--bg-muted)",
            color: "var(--text-primary)",
            fontSize: "13px",
            lineHeight: "1.4",
            outline: "none",
            resize: "none",
            maxHeight: "120px",
            fontFamily: "inherit",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={!text.trim() || loading}
        aria-label="Send message"
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: "none",
          background: !text.trim() || loading ? "var(--bg-muted)" : "var(--color-primary)",
          color: !text.trim() ? "var(--text-muted)" : "#FFF",
          cursor: !text.trim() ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4" style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}

function CompleteTaskPanel({ onClose, onSubmit, loading }) {
  const [remarks, setRemarks] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-label="Complete task" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", borderRadius: "12px", width: "90%", maxWidth: "420px", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px 0" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>Complete Task</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Provide remarks about the completion (optional)</p>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <textarea
            ref={inputRef}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter completion remarks..."
            rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "13px", resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: "8px", padding: "0 20px 16px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onSubmit(remarks.trim())} disabled={loading} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: loading ? "var(--bg-muted)" : "var(--color-success)", color: loading ? "var(--text-muted)" : "#FFF", fontSize: "13px", fontWeight: 600, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            {loading ? <Loader2 className="w-3 h-3" style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle className="w-3.5 h-3.5" />}
            {loading ? "Completing..." : "Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtensionPanel({ onClose, onSubmit, loading }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const dateRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    dateRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-label="Request extension" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", borderRadius: "12px", width: "90%", maxWidth: "420px", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px 0" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>Request Revised Target Date</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Request a revised target date for this task</p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>New Deadline</label>
            <input ref={dateRef} type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need more time..."
              rows={3}
              maxLength={1000}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "13px", resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", padding: "0 20px 16px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onSubmit(date, reason.trim())} disabled={!date || !reason.trim() || loading} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: !date || !reason.trim() || loading ? "var(--bg-muted)" : "var(--color-primary)", color: !date || !reason.trim() ? "var(--text-muted)" : "#FFF", fontSize: "13px", fontWeight: 600, cursor: !date || !reason.trim() ? "default" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            {loading ? <Loader2 className="w-3 h-3" style={{ animation: "spin 1s linear infinite" }} /> : <Clock className="w-3.5 h-3.5" />}
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConversationHub({ initialTaskId, initialMessageId }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(initialTaskId || null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showActionCenter, setShowActionCenter] = useState(false);
  const [pendingActionCount, setPendingActionCount] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [extending, setExtending] = useState(false);
  const [showNewMessagesBtn, setShowNewMessagesBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const pollingRef = useRef(null);
  const initialLoadHandledRef = useRef(false);
  const isAtBottomRef = useRef(true);

  const canViewAllTasks = user?.role === "Super Admin" || user?.canViewAllTasks;

  const scrollToMessage = useCallback((messageId) => {
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "background 0.5s";
        el.style.background =
          "color-mix(in srgb, var(--color-primary) 15%, transparent)";
        setTimeout(() => {
          el.style.background = "";
        }, 2000);
      }
    }, 300);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await conversationAPI.getAll();
      setConversations(res.data.data || []);
    } catch (e) {
      console.error("[ConversationHub] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (initialTaskId) {
      setActiveTaskId(initialTaskId);
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setShowLeftPanel(false);
      }
    }
  }, [initialTaskId]);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const { actionCenterAPI } = await import("@/lib/api");
        const res = await actionCenterAPI.getItems({ filter: "pending" });
        if (!cancelled) setPendingActionCount(res.data.pendingCount || 0);
      } catch (e) {
        console.error("[ConversationHub] action center fetch error:", e);
      }
    };
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener("actionCenterUpdate", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("actionCenterUpdate", handler);
    };
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchMessages = useCallback(async (taskId, opts = {}) => {
    if (!taskId) return;
    const { append = false, cursor: cursorVal } = opts;
    if (append) {
      setMessagesLoadingMore(true);
    } else {
      setMessagesLoading(true);
      setMessages([]);
      setTaskDetail(null);
      setTaskDetailLoading(true);
      setCursor(null);
      setHasMore(false);
    }
    setError(null);
    try {
      const params = { limit: 50 };
      if (cursorVal) params.cursor = cursorVal;
      const [msgRes, taskRes] = await Promise.all([
        conversationAPI.getMessages(taskId, params),
        !append ? taskAPI.getTask(taskId) : Promise.resolve(null),
      ]);
      const newMessages = msgRes.data.data || [];
      const pagination = msgRes.data.pagination || {};
      const prevCursor = pagination.prevCursor || pagination.nextCursor || null;
      const more = pagination.hasMore || false;
      if (append) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const unique = newMessages.filter((m) => !existingIds.has(m._id));
          return [...unique, ...prev];
        });
        setCursor(prevCursor);
        setHasMore(more);
      } else {
        setMessages(newMessages);
        setTaskDetail(taskRes.data?.task || null);
        setCursor(prevCursor);
        setHasMore(more);
      }
      return { messages: newMessages, pagination };
    } catch {
      if (!append) setError("Failed to load messages");
      return { messages: [], pagination: {} };
    } finally {
      if (append) {
        setMessagesLoadingMore(false);
      } else {
        setMessagesLoading(false);
        setTaskDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!activeTaskId) return;

    let cancelled = false;

    const loadConversation = async () => {
      setExpandedGroup(null);

      let result = await fetchMessages(activeTaskId);
      if (cancelled) return;

      const shouldDeepLink = Boolean(
        initialMessageId &&
        initialTaskId &&
        activeTaskId?.toString() === initialTaskId?.toString() &&
        !initialLoadHandledRef.current,
      );

      let foundTarget = shouldDeepLink
        ? result.messages.some((m) => m._id === initialMessageId)
        : false;
      let pagination = result.pagination || {};
      let nextCursor = pagination.prevCursor || null;
      let safety = 0;

      while (
        shouldDeepLink &&
        !foundTarget &&
        pagination.hasMore &&
        nextCursor &&
        safety < 12
      ) {
        result = await fetchMessages(activeTaskId, {
          append: true,
          cursor: nextCursor,
        });
        if (cancelled) return;
        foundTarget = result.messages.some((m) => m._id === initialMessageId);
        pagination = result.pagination || {};
        nextCursor = pagination.prevCursor || null;
        safety += 1;
      }

      if (cancelled) return;

      initialLoadHandledRef.current = true;
      if (shouldDeepLink && foundTarget) {
        scrollToMessage(initialMessageId);
      } else {
        scrollToBottom();
      }
    };

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [
    activeTaskId,
    fetchMessages,
    initialMessageId,
    initialTaskId,
    scrollToBottom,
    scrollToMessage,
  ]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowNewMessagesBtn(false);
    }
    if (!hasMore || messagesLoadingMore) return;
    if (container.scrollTop < 80) {
      fetchMessages(activeTaskId, { append: true, cursor });
    }
  }, [hasMore, messagesLoadingMore, fetchMessages, activeTaskId, cursor]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (activeTaskId) {
      pollingRef.current = setInterval(() => {
        conversationAPI
          .getMessages(activeTaskId, { limit: 1 })
          .then((res) => {
            const newMessages = res.data.data || [];
            if (newMessages.length > 0) {
              const latestNew = newMessages[0];
              setMessages((prev) => {
                if (prev.some((m) => m._id === latestNew._id)) return prev;
                if (isAtBottomRef.current) {
                  setTimeout(() => {
                    if (messagesContainerRef.current) {
                      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                    }
                  }, 50);
                  return [...prev, latestNew];
                }
                setShowNewMessagesBtn(true);
                return [...prev, latestNew];
              });
            }
          })
          .catch((e) => console.error("[ConversationHub] poll error:", e));
      }, 15000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeTaskId]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await conversationAPI.getUnreadCount();
      const total = res.data?.totalUnread || 0;
      window.dispatchEvent(
        new CustomEvent("conversationUnreadUpdate", {
          detail: { totalUnread: total },
        }),
      );
    } catch (e) {
      console.error("[ConversationHub] refresh unread error:", e);
    }
  }, []);

  const handleSelectConversation = async (taskId) => {
    setActiveTaskId(taskId);
    setEditingMessage(null);
    setShowActionCenter(false);
    if (isMobile) setShowLeftPanel(false);
  };

  const handleCompleteTask = async (remarks) => {
    if (!activeTaskId) return;
    setCompleting(true);
    try {
      await taskAPI.updateTask(activeTaskId, {
        status: "completed",
        completionProof: remarks,
      });
      
      // Insert green system message
      const currentDate = fmtFullDate(new Date());
      let messageText = `The task you assigned to me has been completed on ${currentDate}.\n\nKindly let me know if you'd like me to make any changes or if there's anything else I should work on. Thank you.`;
      
      if (remarks && remarks.trim()) {
        messageText += `\n\nRemarks:\n${remarks.trim()}`;
      }
      
      const systemMessage = {
        _id: `temp-${Date.now()}`,
        type: "task_completed",
        text: messageText,
        sender: user,
        createdAt: new Date().toISOString(),
        isSystem: true,
      };
      
      setMessages((prev) => [...prev, systemMessage]);
      
      await fetchMessages(activeTaskId);
      await fetchConversations();
      refreshUnreadCount();
      setShowCompleteModal(false);
      scrollToBottom();
    } catch {
      setError("Failed to complete task");
    } finally {
      setCompleting(false);
    }
  };

  const handleRequestExtension = async (revisedTargetDate, reason) => {
    if (!activeTaskId) return;
    setExtending(true);
    try {
      await taskAPI.requestExtension(activeTaskId, { revisedTargetDate, reason });
      
      // Insert orange system message
      const formattedDate = revisedTargetDate ? fmtFullDate(new Date(revisedTargetDate)) : "";
      let messageText = `I'm working on the assigned task, but I need a little more time to complete it properly. Would it be possible to extend the deadline?\n\nRequested Date:\n${formattedDate}\n\nReason:\n${reason.trim()}`;
      
      const systemMessage = {
        _id: `temp-${Date.now()}`,
        type: "extension_requested",
        text: messageText,
        sender: user,
        createdAt: new Date().toISOString(),
        isSystem: true,
      };
      
      setMessages((prev) => [...prev, systemMessage]);
      
      await fetchMessages(activeTaskId);
      await fetchConversations();
      refreshUnreadCount();
      setShowExtensionModal(false);
      scrollToBottom();
    } catch (err) {
      console.error("Extension request error:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to request extension";
      setError(errorMessage);
    } finally {
      setExtending(false);
    }
  };

  useEffect(() => {
    if (!activeTaskId) return;

    let cancelled = false;

    const syncReadState = async () => {
      try {
        await conversationAPI.markAsRead(activeTaskId);
        if (cancelled) return;
        await Promise.all([fetchConversations(), refreshUnreadCount()]);
      } catch (e) {
        console.error("[ConversationHub] sync read state error:", e);
      }
    };

    syncReadState();

    return () => {
      cancelled = true;
    };
  }, [activeTaskId, fetchConversations, refreshUnreadCount]);

  const handleSendMessage = async (text) => {
    if (!activeTaskId) return;
    setSending(true);
    try {
      const res = await conversationAPI.sendMessage(activeTaskId, {
        text,
        type: "text",
      });
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
        scrollToBottom();
      }
      setError(null);
      await fetchConversations();
      refreshUnreadCount();
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = useCallback(async (messageId, newText) => {
    if (!newText.trim()) return;
    try {
      const res = await conversationAPI.editMessage(messageId, {
        text: newText,
      });
      if (res.data?.data) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? res.data.data : m)),
        );
      }
      setEditingMessage(null);
      setEditText("");
    } catch {
      setError("Failed to edit message");
    }
  }, []);

  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      await conversationAPI.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch {
      setError("Failed to delete message");
    }
  }, []);

  const hasUnreadTasks = (group) => group.unreadTotal > 0;

  const getGroupName = (group) => {
    if (canViewAllTasks) return group.user?.name || "Employee";
    return group.user?.name || "Assigner";
  };

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "40vh",
          color: "var(--text-secondary)",
          fontSize: "14px",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: isMobile ? "100%" : "520px",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        background: "var(--bg-surface)",
        position: "relative",
      }}
    >
      <div
        className="conversation-list-panel"
        style={{
          width: isMobile ? "100%" : "350px",
          minWidth: isMobile ? "100%" : "350px",
          maxWidth: isMobile ? "100%" : "350px",
          borderRight: isMobile ? "none" : "1px solid var(--border)",
          background: "var(--bg-surface)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...(isMobile ? {
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10,
            visibility: showLeftPanel ? "visible" : "hidden",
          } : {}),
        }}
      >
          <div
            style={{
              padding: "14px 14px 8px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {canViewAllTasks ? "Employees" : "Conversations"}
              </span>
              {!loading && conversations.length > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    background: "var(--bg-muted)",
                    padding: "2px 9px",
                    borderRadius: "999px",
                  }}
                >
                  {conversations.reduce(
                    (sum, g) => sum + (g.tasks?.length || 0),
                    0,
                  )}{" "}
                  task
                  {conversations.reduce(
                    (sum, g) => sum + (g.tasks?.length || 0),
                    0,
                  ) !== 1
                    ? "s"
                    : ""}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setShowActionCenter(true);
                setActiveTaskId(null);
                if (isMobile) setShowLeftPanel(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 10px",
                border: "none",
                cursor: "pointer",
                borderRadius: "10px",
                textAlign: "left",
                transition: "background 0.15s",
                background: showActionCenter
                  ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                  : "transparent",
                color: showActionCenter
                  ? "var(--color-primary)"
                  : "var(--text-primary)",
              }}
              onMouseEnter={(e) =>
                !showActionCenter &&
                (e.currentTarget.style.background = "var(--bg-muted)")
              }
              onMouseLeave={(e) =>
                !showActionCenter &&
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: showActionCenter
                    ? "var(--color-primary)"
                    : "var(--bg-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: showActionCenter ? "#FFF" : "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: showActionCenter
                      ? "var(--color-primary)"
                      : "var(--text-primary)",
                  }}
                >
                  Action Center
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    display: "block",
                  }}
                >
                  Review pending items
                </span>
              </div>
              {pendingActionCount > 0 && (
                <span
                  style={{
                    background: "var(--color-danger)",
                    color: "#FFF",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "10px",
                    minWidth: "18px",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {pendingActionCount > 99 ? "99+" : pendingActionCount}
                </span>
              )}
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "8px",
              scrollBehavior: "smooth",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                <Loader2
                  className="w-4 h-4"
                  style={{
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 8px",
                  }}
                />
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                No conversations yet
              </div>
            ) : (
              conversations.map((group, gi) => {
                const isExpanded = expandedGroup === gi;
                return (
                  <div key={gi}>
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : gi)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: isMobile ? "12px 10px" : "10px 10px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        borderRadius: "10px",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-muted)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: hasUnreadTasks(group)
                            ? "var(--color-primary)"
                            : "var(--bg-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: hasUnreadTasks(group)
                            ? "#FFF"
                            : "var(--text-muted)",
                          fontSize: "15px",
                          fontWeight: 600,
                          flexShrink: 0,
                          overflow: "hidden",
                        }}
                      >
                        {group.user?.avatar ? (
                          <img
                            src={group.user.avatar}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          getGroupName(group).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {getGroupName(group)}
                          </span>
                          {group.unreadTotal > 0 && (
                            <span
                              style={{
                                background: "var(--color-danger)",
                                color: "#FFF",
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: "10px",
                                minWidth: "18px",
                                textAlign: "center",
                              }}
                            >
                              {group.unreadTotal > 99
                                ? "99+"
                                : group.unreadTotal}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {canViewAllTasks
                            ? group.user?.role || ""
                            : `${group.tasks.length} task${group.tasks.length !== 1 ? "s" : ""}`}
                        </span>
                        {!isExpanded && group.tasks[0]?.lastMessageText && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              display: "block",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              marginTop: "1px",
                              opacity: 0.7,
                            }}
                          >
                            {group.tasks[0].lastMessageText.slice(0, 50)}
                            {group.tasks[0].lastMessageText.length > 50 ? "..." : ""}
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--text-muted)" }}
                        />
                      ) : (
                        <ChevronRight
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--text-muted)" }}
                        />
                      )}
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          paddingLeft: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          marginTop: "2px",
                          marginBottom: "4px",
                        }}
                      >
                        {group.tasks.map((task) => {
                          const tid = task.taskId?._id || task.taskId;
                          const isActive =
                            tid?.toString() === activeTaskId?.toString();
                          return (
                            <button
                              key={tid?.toString()}
                              onClick={() =>
                                handleSelectConversation(tid?.toString())
                              }
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: isMobile ? "12px 10px" : "9px 10px",
                                border: "none",
                                borderLeft: isActive
                                  ? "3px solid var(--color-primary)"
                                  : "3px solid transparent",
                                background: isActive
                                  ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                                  : "transparent",
                                cursor: "pointer",
                                borderRadius: "8px",
                                textAlign: "left",
                                fontSize: "12px",
                                color: isActive
                                  ? "var(--text-primary)"
                                  : "var(--text-secondary)",
                                transition: "background 0.15s, border-color 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive)
                                  e.currentTarget.style.background =
                                    "var(--bg-muted)";
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive)
                                  e.currentTarget.style.background =
                                    "transparent";
                              }}
                            >
                              <div style={{ position: "relative", flexShrink: 0 }}>
                                <MessageSquare
                                  className="w-3 h-3"
                                  style={{
                                    color: isActive
                                      ? "var(--color-primary)"
                                      : "var(--text-muted)",
                                  }}
                                />
                                {task.priority && (
                                  <span style={{
                                    position: "absolute", top: "-2px", right: "-3px",
                                    width: "5px", height: "5px", borderRadius: "50%",
                                    background: PRIORITY_STYLE[task.priority] || "var(--text-muted)",
                                  }} />
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, minWidth: 0 }}>
                                    <span
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: 500,
                                        color: "var(--text-primary)",
                                        textOverflow: "ellipsis",
                                        overflow: "hidden",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {task.title}
                                    </span>
                                    {task.status && task.status !== "In Progress" && (
                                      <span style={{
                                        fontSize: "8px", fontWeight: 600, padding: "1px 4px",
                                        borderRadius: "4px", flexShrink: 0,
                                        background: `color-mix(in srgb, ${STATUS_STYLE[task.status] || "var(--text-muted)"} 15%, transparent)`,
                                        color: STATUS_STYLE[task.status] || "var(--text-muted)",
                                      }}>
                                        {task.status === "Completed" ? "Done" : task.status}
                                      </span>
                                    )}
                                  </div>
                                  {task.lastMessageTime && (
                                    <span
                                      style={{
                                        fontSize: "9px",
                                        color: "var(--text-muted)",
                                        flexShrink: 0,
                                        marginLeft: "4px",
                                      }}
                                    >
                                      {timeAgo(task.lastMessageTime)}
                                    </span>
                                  )}
                                </div>
                                {task.lastMessageText && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--text-muted)",
                                      display: "block",
                                      textOverflow: "ellipsis",
                                      overflow: "hidden",
                                      whiteSpace: "nowrap",
                                      marginTop: "1px",
                                    }}
                                  >
                                    {task.lastMessageText.slice(0, 60)}
                                    {task.lastMessageText.length > 60
                                      ? "..."
                                      : ""}
                                  </span>
                                )}
                              </div>
                              {task.unreadCount > 0 && (
                                <span
                                  style={{
                                    background: "var(--color-danger)",
                                    color: "#FFF",
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: "8px",
                                    minWidth: "16px",
                                    textAlign: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {task.unreadCount > 99
                                    ? "99+"
                                    : task.unreadCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: isMobile && showLeftPanel ? "none" : "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {showActionCenter ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
            <button
              onClick={() => { setShowActionCenter(false); if (isMobile) setShowLeftPanel(true); }}
              className="mobile-back-btn"
              style={{ padding: "4px", borderRadius: "6px", border: "none", background: "var(--bg-muted)", color: "var(--text-secondary)", cursor: "pointer", display: isMobile ? "inline-flex" : "none", flexShrink: 0 }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Bell className="w-4 h-4" />
              Action Center
            </span>
          </div>
        ) : activeTaskId && (
          <TaskHeader
            task={taskDetail}
            loading={taskDetailLoading}
            user={user}
            isMobile={isMobile}
            onBack={() => { setActiveTaskId(null); if (isMobile) setShowLeftPanel(true); }}
          />
        )}

        {error && (
          <div
            style={{
              padding: "8px 12px",
              margin: "4px 12px",
              borderRadius: "8px",
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              color: "var(--color-danger)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "var(--color-danger)",
                cursor: "pointer",
                padding: "2px",
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {showActionCenter ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ActionCenter />
          </div>
        ) : (
          <>
            {showNewMessagesBtn && (
              <div style={{ position: "relative", flexShrink: 0, height: 0, zIndex: 5, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => {
                    setShowNewMessagesBtn(false);
                    scrollToBottom();
                  }}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "20px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: "var(--color-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transform: "translateY(-100%)",
                  }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  New Messages
                </button>
              </div>
            )}
            <div
              ref={messagesContainerRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                padding: isMobile ? "12px 14px" : "16px 24px",
                scrollBehavior: "smooth",
              }}
            >
              {messagesLoadingMore && (
                <div style={{ textAlign: "center", padding: "8px" }}>
                  <Loader2
                    className="w-4 h-4"
                    style={{
                      animation: "spin 1s linear infinite",
                      color: "var(--text-muted)",
                    }}
                  />
                </div>
              )}
              {messagesLoading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  <Loader2
                    className="w-5 h-5"
                    style={{
                      animation: "spin 1s linear infinite",
                      marginRight: "8px",
                    }}
                  />
                  Loading messages...
                </div>
              ) : !activeTaskId ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--text-muted)",
                  }}
                >
                  <MessageSquare
                    className="w-12 h-12"
                    style={{ opacity: 0.3, marginBottom: "12px" }}
                  />
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Select a conversation
                  </p>
                  <p style={{ fontSize: "13px" }}>
                    Choose a task from the left panel to start chatting
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--text-muted)",
                  }}
                >
                  <MessageSquare
                    className="w-10 h-10"
                    style={{ opacity: 0.3, marginBottom: "8px" }}
                  />
                  <p style={{ fontSize: "13px" }}>
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                <>
                  {(() => {
                    let lastDate = "";
                    return messages.map((msg, idx) => {
                      const msgDate = fmtDate(msg.createdAt);
                      const showDateHeader = msgDate !== lastDate;
                      lastDate = msgDate;
                      const isOwn =
                        msg.sender?._id === user?._id ||
                        msg.sender?.toString() === user?._id?.toString();

                      return (
                        <div key={msg._id || idx}>
                          {showDateHeader && (
                            <div
                              style={{
                                textAlign: "center",
                                padding: "8px 0 4px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "var(--text-muted)",
                                  background: "var(--bg-muted)",
                                  padding: "2px 12px",
                                  borderRadius: "12px",
                                }}
                              >
                                {msgDate}
                              </span>
                            </div>
                          )}
                          {editingMessage?._id === msg._id ? (
                            <div
                              style={{
                                padding: "8px",
                                background: "var(--bg-muted)",
                                borderRadius: "8px",
                                margin: "4px 0",
                              }}
                            >
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  borderRadius: "6px",
                                  border: "1px solid var(--border)",
                                  background: "var(--bg-surface)",
                                  color: "var(--text-primary)",
                                  fontSize: "13px",
                                  minHeight: "60px",
                                  resize: "vertical",
                                }}
                              />
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  marginTop: "6px",
                                }}
                              >
                                <button
                                  onClick={() =>
                                    handleEditMessage(msg._id, editText)
                                  }
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "var(--color-primary)",
                                    color: "#FFF",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMessage(null);
                                    setEditText("");
                                  }}
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-surface)",
                                    color: "var(--text-secondary)",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <MessageBubble
                              message={msg}
                              isOwn={isOwn}
                              onEdit={(m) => {
                                setEditingMessage(m);
                                setEditText(m.text);
                              }}
                              onDelete={handleDeleteMessage}
                            />
                          )}
                        </div>
                      );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {activeTaskId && showCompleteModal && (
              <CompleteTaskPanel
                onClose={() => setShowCompleteModal(false)}
                onSubmit={handleCompleteTask}
                loading={completing}
              />
            )}
            {activeTaskId && showExtensionModal && (
              <ExtensionPanel
                onClose={() => setShowExtensionModal(false)}
                onSubmit={handleRequestExtension}
                loading={extending}
              />
            )}

            {activeTaskId && (
              <MessageInput 
                onSend={handleSendMessage} 
                loading={sending} 
                onCompleteTask={() => setShowCompleteModal(true)}
                onRequestExtension={() => setShowExtensionModal(true)}
              />
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <style jsx>{`
        @media (max-width: 768px) {
          .conversation-list-panel {
            border-right: none !important;
          }
        }
      `}</style>
    </div>
  );
}