import { advanceByMonths } from "./taskGenerationEngine.js";
import { getKolkataDateParts } from "./istTime.js";

/**
 * Overdue Engine
 *
 * Determines when a recurring generated task should be marked as Overdue
 * based on its occurrence schedule, not a traditional deadline.
 *
 * Supports two overdue models:
 *   1. deadline-based — existing behaviour for tasks with a deadline
 *   2. recurring schedule-based — new behaviour for tasks without a deadline
 *      where the window expires when the next occurrence would be generated.
 */

/**
 * Calculate when a recurring task's valid occurrence window expires.
 *
 * For a task generated at occurrenceDate with interval X, the window expires
 * at occurrenceDate + interval. After that point the task is considered overdue.
 *
 * Returns null for non-recurring, one-time, or deadline-only tasks.
 */
export function calculateRecurringExpiry(task) {
  if (!task.isGeneratedOccurrence || !task.occurrenceDate || task.taskType === "One Time") {
    return null;
  }

  const base = new Date(task.occurrenceDate);

  // Custom — interval-based expiry matching the generation schedule
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

  // Calendar-based types — expiry aligns with the next scheduled occurrence
  switch (task.taskType) {
    case "Daily":
      return new Date(base.getTime() + 86400000);
    case "Weekly":
      return new Date(base.getTime() + 604800000);
    case "Monthly":
    case "Quarterly":
    case "Half Yearly":
    case "Yearly": {
      const { year, month, day, hour, minute } = getKolkataDateParts(base);
      return advanceByMonths(task.taskType, day, year, month, day, hour, minute);
    }
    default:
      return null;
  }
}

/**
 * Check whether a recurring generated task is overdue based on its schedule.
 *
 * Only applies to generated recurring tasks WITHOUT a deadline.
 * Tasks with a deadline continue using deadline-based overdue logic.
 */
export function isRecurringTaskOverdue(task, now = new Date()) {
  if (task.status === "Completed" || task.status === "Cancelled" || task.status === "Overdue") {
    return false;
  }
  if (!task.isGeneratedOccurrence || !task.occurrenceDate) {
    return false;
  }
  if (task.deadline) {
    return false;
  }

  const expiry = calculateRecurringExpiry(task);
  if (!expiry) return false;

  return now >= expiry;
}
