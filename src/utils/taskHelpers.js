export const TASK_STATUS_MAP = {
  "in progress": "In Progress",
  inprogress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  "on hold": "On Hold",
  onhold: "On Hold",
  overdue: "Overdue",
};

export const RESTRICTED_ROLES = ["Sales Executive", "Coordinator", "HR"];
export const ADMIN_ROLES = ["Super Admin", "Admin", "HR"];

export function normalizeTaskStatus(rawStatus) {
  return TASK_STATUS_MAP[rawStatus.toLowerCase()] || rawStatus;
}

export function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

export function buildAssigneeProgress(userIds) {
  return userIds.map((userId) => ({
    user: userId,
    status: "Pending",
    actualHours: 0,
  }));
}

export function buildHistoryEntry(status, changedBy, note) {
  return { status, changedBy, changedAt: new Date(), note };
}

export function buildNotification({ recipient, sender, title, message, type, entityId, priority }) {
  return {
    recipient,
    sender,
    title,
    message,
    type,
    ...(priority && { priority }),
    entityId,
    entityType: "Task",
    actionUrl: `/dashboard/tasks/${entityId}`,
  };
}

export const TASK_DEFAULT_POPULATE = [
  { path: "assignedTo", select: "name email role avatar employeeId" },
  { path: "assignedBy", select: "name email role" },
  { path: "assigneeProgress.user", select: "name email role" },
];
