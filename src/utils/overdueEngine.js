/**
 * Overdue Engine — Unified
 *
 * Determines when any task is overdue using a single rule:
 *
 *   Current Time >= Deadline
 *
 * Backward-compatible fallback for tasks still stored without a deadline
 * (pre-migration) uses occurrenceDate + recurrence interval.
 */

/**
 * Calculate when a task's valid occurrence window expires.
 * Used as backward-compatible fallback for tasks without a deadline.
 */
export function calculateRecurringExpiry(task) {
  if (!task.isGeneratedOccurrence || !task.occurrenceDate || task.taskType === "One Time") {
    return null;
  }

  const base = new Date(task.occurrenceDate);

  if (task.taskType === "Custom") {
    const intervalValue = Number(
      task.recurrencePattern?.intervalValue ?? task.recurrencePattern?.interval ?? 1,
    );
    const intervalUnit = task.recurrencePattern?.intervalUnit || "Days";

    switch (intervalUnit) {
      case "Minutes":
        return new Date(base.getTime() + intervalValue * 60000);
      case "Hours":
        return new Date(base.getTime() + intervalValue * 3600000);
      case "Days":
        return new Date(base.getTime() + intervalValue * 86400000);
      case "Weeks":
        return new Date(base.getTime() + intervalValue * 604800000);
      case "Months": {
        const d = new Date(base);
        d.setMonth(d.getMonth() + intervalValue);
        return d;
      }
      default:
        return new Date(base.getTime() + 86400000);
    }
  }

  switch (task.taskType) {
    case "Daily":
      return new Date(base.getTime() + 86400000);
    case "Weekly":
      return new Date(base.getTime() + 604800000);
    case "Monthly":
    case "Quarterly":
    case "Half Yearly":
    case "Yearly":
    default:
      return null;
  }
}

/**
 * Unified overdue check.
 *
 * Primary: checks if deadline exists and now >= deadline.
 * Fallback: checks occurrenceDate + interval (for pre-migration tasks).
 */
export function isRecurringTaskOverdue(task, now = new Date()) {
  if (task.status === "Completed" || task.status === "Cancelled" || task.status === "Overdue") {
    return false;
  }

  // Primary path: use deadline field
  if (task.deadline) {
    return now >= new Date(task.deadline);
  }

  // Fallback path: occurrenceDate-based (backward compat for pre-migration tasks)
  if (!task.isGeneratedOccurrence || !task.occurrenceDate) {
    return false;
  }

  const expiry = calculateRecurringExpiry(task);
  if (!expiry) return false;

  return now >= expiry;
}
