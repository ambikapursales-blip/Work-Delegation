import { isRecurringTaskOverdue } from "./overdueEngine.js";
import { getKolkataDateParts, createKolkataDate, toKolkataDate } from "./istTime.js";

const MINUTE = 60 * 1000;

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date, minutes) {
  const next = new Date(date);
  next.setTime(next.getTime() + minutes * MINUTE);
  return next;
}

function getNextReminderAt(task, now = new Date(), reminderState = null) {
  const taskType = normalizeTaskType(
    task?.taskType || task?.emailSchedule?.taskType,
  );

  if (taskType === "Custom") {
    const intervalMinutes = getReminderIntervalMinutes(task);
    const baseTime = reminderState?.lastReminderAt
      ? toKolkataDate(reminderState.lastReminderAt)
      : toKolkataDate(task?.createdAt) || toKolkataDate(now);

    return intervalMinutes && baseTime
      ? addMinutes(baseTime, intervalMinutes)
      : null;
  }

  const current = toDate(now) || new Date();
  const { year, month, day } = getKolkataDateParts(current);

  switch (taskType) {
    case "Daily":
      return createKolkataDate(year, month, day + 1, 9, 0, 0);
    case "Weekly":
      return createKolkataDate(year, month, day + 7, 9, 0, 0);
    case "Monthly":
      return createKolkataDate(year, month + 1, day, 9, 0, 0);
    case "Quarterly":
      return createKolkataDate(year, month + 3, day, 9, 0, 0);
    case "Half Yearly":
      return createKolkataDate(year, month + 6, day, 9, 0, 0);
    case "Yearly":
      return createKolkataDate(year + 1, month, day, 9, 0, 0);
    default:
      return null;
  }
}

function normalizeTaskType(taskType) {
  if (!taskType) return "One Time";
  const normalized = String(taskType).trim();
  const map = {
    "One-time": "One Time",
    "One time": "One Time",
    "one-time": "One Time",
    "one time": "One Time",
    custom: "Custom",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    halfyearly: "Half Yearly",
    yearly: "Yearly",
    "half yearly": "Half Yearly",
    "half-yearly": "Half Yearly",
  };
  return map[normalized] || normalized;
}

export function getReminderIntervalMinutes(
  task,
  recurrencePattern = task?.recurrencePattern,
) {
  const taskType = normalizeTaskType(
    task?.taskType || task?.emailSchedule?.taskType,
  );

  if (taskType === "Custom") {
    const value = Number(
      recurrencePattern?.intervalValue ?? recurrencePattern?.interval ?? 1,
    );
    const unit = String(
      recurrencePattern?.intervalUnit || "Days",
    ).toLowerCase();

    switch (unit) {
      case "minutes":
        return value;
      case "hours":
        return value * 60;
      case "days":
        return value * 24 * 60;
      case "weeks":
        return value * 7 * 24 * 60;
      case "months":
        return value * 30 * 24 * 60;
      case "years":
        return value * 365 * 24 * 60;
      default:
        return value * 24 * 60;
    }
  }

  const map = {
    Daily: 24 * 60,
    Weekly: 7 * 24 * 60,
    Monthly: 30 * 24 * 60,
    Quarterly: 90 * 24 * 60,
    "Half Yearly": 180 * 24 * 60,
    Yearly: 365 * 24 * 60,
  };

  return map[taskType] || null;
}

export function getReminderMode(task, now = new Date()) {
  const currentDate = toDate(now) || new Date();
  const deadline = toDate(task?.deadline);
  const status = task?.status;

  // Parent recurring tasks are metadata only — never send overdue reminders
  if (task?.isRecurring && !task?.isGeneratedOccurrence) {
    return "normal";
  }

  // Stop reminders for completed tasks
  // "Cancelled" check kept for backward compatibility with existing data
  if (status === "Completed" || status === "Cancelled") {
    return "stopped";
  }

  // Deadline-based overdue
  if (deadline && currentDate > deadline) {
    return "overdue";
  }

  // Recurring schedule-based overdue (tasks without deadline)
  if (!deadline && isRecurringTaskOverdue(task, now)) {
    return "overdue";
  }

  return "normal";
}

export function createReminderStateEntry(userId, task, now = new Date()) {
  const nextReminderAt = getNextReminderAt(task, now);

  return {
    user: userId,
    lastReminderAt: null,
    nextReminderAt,
    lastReminderType: "normal",
    reminderCount: 0,
    isPaused: false,
    pausedReason: null,
    lastReminderStatus: task?.status || "In Progress",
    lastEmailTemplate: "assignment",
    milestoneFlags: {
      fourDays: false,
      threeDays: false,
      twoDays: false,
      oneDay: false,
      dueToday: false,
    },
    lockUntil: null,
  };
}

export function resetReminderStateForTask(task, now = new Date()) {
  const assigneeIds = Array.isArray(task?.assignedTo)
    ? task.assignedTo.map((id) =>
        typeof id === "object" ? id.toString() : String(id),
      )
    : task?.assignedTo
      ? [String(task.assignedTo)]
      : [];

  const existingEntries = Array.isArray(task?.reminderState)
    ? task.reminderState
    : [];
  const nextEntries = assigneeIds.map((userId) => {
    const existing = existingEntries.find(
      (entry) => entry?.user?.toString() === userId,
    );
    if (existing) {
      return {
        ...existing,
        nextReminderAt: getNextReminderAt(task, now),
        lastReminderAt: null,
        reminderCount: 0,
        isPaused: false,
        pausedReason: null,
        lastReminderType: "normal",
        lastEmailTemplate: "assignment",
        lastReminderStatus: task?.status || "In Progress",
        lockUntil: null,
      };
    }

    return createReminderStateEntry(userId, task, now);
  });

  task.reminderState = nextEntries;
  return task.reminderState;
}

export function ensureReminderState(task, userId, now = new Date()) {
  const reminderState = Array.isArray(task?.reminderState)
    ? task.reminderState.find(
        (entry) => entry?.user?.toString() === userId?.toString(),
      )
    : null;

  if (reminderState) {
    return reminderState;
  }

  const entry = createReminderStateEntry(userId, task, now);
  if (!task.reminderState) {
    task.reminderState = [];
  }
  task.reminderState.push(entry);
  return entry;
}

export function shouldSendReminder(task, reminderState, now = new Date()) {
  if (!reminderState || reminderState.isPaused) {
    return false;
  }

  // Stop reminders for completed tasks
  // "Cancelled" check kept for backward compatibility with existing data
  if (task?.status === "Completed" || task?.status === "Cancelled") {
    return false;
  }

  const current = toDate(now) || new Date();
  const lockUntil = toDate(reminderState.lockUntil);
  if (lockUntil && current < lockUntil) {
    return false;
  }

  const matchingProgress = (task?.assigneeProgress || []).find(
    (entry) => entry?.user?.toString() === reminderState?.user?.toString(),
  );
  if (matchingProgress?.status === "Completed") {
    return false;
  }

  if (!reminderState.nextReminderAt) {
    return false;
  }

  const next = toDate(reminderState.nextReminderAt);
  const result = Boolean(next && current >= next);
  return result;
}

export function updateReminderStateAfterSend(
  task,
  reminderState,
  now = new Date(),
  mode = "normal",
) {
  const current = toKolkataDate(now) || new Date();
  const updated = {
    ...reminderState,
    lastReminderAt: current,
    nextReminderAt: getNextReminderAt(task, current, {
      ...reminderState,
      lastReminderAt: reminderState?.lastReminderAt || current,
    }),
    lastReminderType: mode,
    reminderCount: (reminderState.reminderCount || 0) + 1,
    lastReminderStatus: task?.status || "In Progress",
    lastEmailTemplate: mode === "overdue" ? "overdue" : "reminder",
    lockUntil: addMinutes(current, 1),
  };

  return updated;
}

export function pauseReminderStateEntry(
  reminderState,
  reason,
  emailTemplate = "completion",
) {
  return {
    ...reminderState,
    isPaused: true,
    pausedReason: reason,
    lastReminderType: "stopped",
    lastEmailTemplate: emailTemplate,
  };
}

export function markReminderPaused(reminderState, reason) {
  return pauseReminderStateEntry(reminderState, reason);
}

export function pauseAllReminderStateEntries(
  task,
  reason,
  emailTemplate = "completion",
) {
  if (!Array.isArray(task?.reminderState)) return [];
  return task.reminderState.map((entry) =>
    pauseReminderStateEntry(entry, reason, emailTemplate),
  );
}

export function shouldSendDeadlineMilestone(
  task,
  reminderState,
  now = new Date(),
) {
  const status = task?.status;
  // Stop milestone reminders for completed tasks
  // "Cancelled" check kept for backward compatibility with existing data
  if (status === "Completed" || status === "Cancelled") {
    return false;
  }

  const deadline = toDate(task?.deadline);
  if (!deadline) {
    return false;
  }

  const current = toDate(now) || new Date();
  const deadlineParts = getKolkataDateParts(deadline);
  const currentParts = getKolkataDateParts(current);
  const deadlineDate = createKolkataDate(deadlineParts.year, deadlineParts.month, deadlineParts.day, 0, 0, 0);
  const currentDate = createKolkataDate(currentParts.year, currentParts.month, currentParts.day, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - currentDate.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const milestoneMap = {
    4: "fourDays",
    3: "threeDays",
    2: "twoDays",
    1: "oneDay",
    0: "dueToday",
  };

  const milestoneKey = milestoneMap[daysRemaining];
  if (!milestoneKey) {
    return false;
  }

  return !reminderState?.milestoneFlags?.[milestoneKey];
}

export function markDeadlineMilestoneSent(reminderState, milestoneKey) {
  return {
    ...reminderState,
    milestoneFlags: {
      ...(reminderState?.milestoneFlags || {}),
      [milestoneKey]: true,
    },
  };
}
