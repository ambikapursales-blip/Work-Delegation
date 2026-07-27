/**
 * Task Generation Engine
 * 
 * Core logic for generating task occurrences from recurring templates.
 * This engine handles:
 * - Calculating next generation dates
 * - Generating task occurrences with proper naming
 * - Creating all side effects (conversation, notification, activity, reminder state)
 */

import Task from "../models/Task.js";
import RecurringTemplate from "../models/RecurringTemplate.js";
import { generateOccurrenceName } from "./occurrenceNaming.js";
import { createReminderStateEntry } from "./reminderEngine.js";
import { createEmailSchedule } from "./emailFrequencyEngine.js";
import { buildAssigneeProgress } from "./taskHelpers.js";
import { notifyTaskAssigned } from "./conversationMessages.js";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import Conversation from "../models/Conversation.js";
import { buildActionUrl } from "./conversationAuth.js";
import { getKolkataDateParts, createKolkataDate, getKolkataDayOfWeek } from "./istTime.js";
import { sendTaskAssignmentEmail } from "./emailService.js";
import { generateCompleteToken } from "./completeToken.js";
import { generateCommentToken } from "./commentToken.js";
import { generateExtensionToken } from "./extensionToken.js";

/**
 * Calculate the next calendar-based occurrence date at scheduled time for non-Custom task types.
 * For Custom task types, uses the existing interval-based calculation.
 *
 * Calendar-based types (Daily, Weekly, Monthly, Quarterly, Half Yearly, Yearly):
 * - Always return the next scheduled slot at scheduledHour:scheduledMinute IST.
 * - The recurrence day is anchored to the template's startDate (original creation day),
 *   or to recurrencePattern.daysOfWeek / dayOfMonth when configured.
 * - Edge cases (e.g. Jan 31 → Feb 28) use day-of-month clamping (last valid day).
 *
 * Custom:
 * - Uses interval-based calculation (baseDate + interval).
 */
export function calculateNextGenerationDate(template, baseDate = new Date()) {
  const { taskType, recurrencePattern, startDate, scheduledHour = 9, scheduledMinute = 0 } = template;
  const base = baseDate || new Date();
  const { year, month, day } = getKolkataDateParts(base);
  const sh = scheduledHour;
  const sm = scheduledMinute;

  // Custom — interval-based, normalized to cron minute boundaries
  if (taskType === "Custom") {
    const intervalValue = recurrencePattern?.intervalValue || 1;
    const intervalUnit = recurrencePattern?.intervalUnit || "Days";
    const nextDate = new Date(base);
    switch (intervalUnit) {
      case "Minutes":
        nextDate.setMinutes(nextDate.getMinutes() + intervalValue);
        break;
      case "Hours":
        nextDate.setHours(nextDate.getHours() + intervalValue);
        break;
      case "Days":
        nextDate.setDate(nextDate.getDate() + intervalValue);
        break;
      case "Weeks":
        nextDate.setDate(nextDate.getDate() + 7 * intervalValue);
        break;
      case "Months":
        nextDate.setMonth(nextDate.getMonth() + intervalValue);
        break;
      default:
        nextDate.setDate(nextDate.getDate() + intervalValue);
    }
    // Normalize to cron minute boundaries: remove milliseconds and seconds
    nextDate.setSeconds(0, 0);
    
    // Debug logging
    console.log("[TaskGenerationEngine] Custom recurrence");
    console.log(`Base: ${base.toISOString()}`);
    console.log(`Next: ${nextDate.toISOString()}`);
    console.log(`Interval: ${intervalValue} ${intervalUnit}`);
    
    return nextDate;
  }

  const anchorDate = startDate || base;

  switch (taskType) {
    case "Daily":
      return createKolkataDate(year, month, day + 1, sh, sm, 0);

    case "Weekly": {
      const dow = getWeeklyTargetDay(recurrencePattern, anchorDate, base);
      const baseDow = getKolkataDayOfWeek(base);
      const daysUntil = (dow - baseDow + 7) % 7;
      if (daysUntil === 0) {
        return createKolkataDate(year, month, day + 7, sh, sm, 0);
      }
      return createKolkataDate(year, month, day + daysUntil, sh, sm, 0);
    }

    case "Monthly":
    case "Quarterly":
    case "Half Yearly":
    case "Yearly": {
      const anchorDom = getKolkataDateParts(anchorDate).day;
      return advanceByMonths(taskType, anchorDom, year, month, day, sh, sm);
    }

    default:
      return createKolkataDate(year, month, day + 1, sh, sm, 0);
  }
}

/**
 * Determine the target day-of-week for Weekly recurrence.
 * Priority order:
 *   1. recurrencePattern.daysOfWeek — configured weekdays (e.g. [1] for Monday).
 *   2. anchorDate's day of week — original creation day.
 */
function getWeeklyTargetDay(recurrencePattern, anchorDate, baseDate) {
  const configured = recurrencePattern?.daysOfWeek;
  if (configured && Array.isArray(configured) && configured.length > 0) {
    const sorted = [...configured].sort((a, b) => a - b);
    const baseDow = getKolkataDayOfWeek(baseDate);
    const future = sorted.find((d) => d > baseDow);
    return future !== undefined ? future : sorted[0];
  }
  return getKolkataDayOfWeek(anchorDate);
}

/**
 * Advance by the appropriate number of months based on taskType.
 * Clamps the day-of-month to the last valid day of the target month.
 */
export function advanceByMonths(taskType, anchorDom, year, month, day, sh, sm, customInterval) {
  const monthsMap = { Monthly: 1, Quarterly: 3, "Half Yearly": 6, Yearly: 12 };
  const addMonths = customInterval ?? monthsMap[taskType] ?? 1;

  // Last day of the current month in IST month numbering (1-based)
  const lastDayThisMonth = new Date(year, month, 0).getDate();
  const targetThisMonth = Math.min(anchorDom, lastDayThisMonth);
  const thisMonthDate = createKolkataDate(year, month, targetThisMonth, sh, sm, 0);

  if (day < targetThisMonth) {
    return thisMonthDate;
  }

  let nextMonth = month + addMonths;
  let nextYear = year;
  while (nextMonth > 12) { nextMonth -= 12; nextYear++; }
  const lastDayNext = new Date(nextYear, nextMonth, 0).getDate();
  const targetNext = Math.min(anchorDom, lastDayNext);
  return createKolkataDate(nextYear, nextMonth, targetNext, sh, sm, 0);
}

/**
 * Recalculate nextGenerationDate for all active templates using the new IST schedule.
 * Called once on cron startup to fix any templates with incorrect dates from the old
 * relative-time calculation. Does NOT generate tasks — only updates the stored date.
 */
export async function recalculateAllTemplateDates() {
  try {
    const templates = await RecurringTemplate.find({ status: "Active", isActive: true });
    let updated = 0;
    for (const template of templates) {
      const baseDate = template.lastGeneratedDate || template.startDate || new Date();
      const corrected = calculateNextGenerationDate(template, baseDate);
      if (!template.nextGenerationDate ||
          template.nextGenerationDate.getTime() !== corrected.getTime()) {
        template.nextGenerationDate = corrected;
        await template.save();
        updated++;
      }
    }
    if (updated > 0) {
      console.log(`[TaskGenerationEngine] Recalculated nextGenerationDate for ${updated} active templates`);
    }
    return updated;
  } catch (error) {
    console.error("[TaskGenerationEngine] Failed to recalculate template dates:", error);
    return 0;
  }
}

/**
 * Send assignment email for a single generated task.
 * Updates the task's assignment email tracking fields.
 * Never throws — failures are logged and stored on the task.
 */
export async function sendAssignmentEmailForTask(task) {
  if (task.assignmentEmailSent) {
    return;
  }

  try {
    await task.populate("assignedTo assignedBy");

    const assignees = Array.isArray(task.assignedTo)
      ? task.assignedTo
      : [task.assignedTo];

    let allSucceeded = true;

    for (const assignee of assignees) {
      if (!assignee?.email) continue;

      try {
        const assigneeUserId = String(assignee._id);
        const taskId = String(task._id);
        const completeToken = generateCompleteToken(taskId, assigneeUserId);
        const commentToken = generateCommentToken(taskId, assigneeUserId);
        const extensionToken = generateExtensionToken(taskId, assigneeUserId);

        await sendTaskAssignmentEmail(assignee.email, assignee.name, {
          title: task.title,
          description: task.description,
          priority: task.priority,
          deadline: task.deadline,
          taskId: task._id,
          userId: assignee._id,
          completeToken,
          commentToken,
          extensionToken,
          assignedBy: {
            name: task.assignedBy?.name || "Unknown",
            email: task.assignedBy?.email,
          },
        });
      } catch (emailError) {
        console.error(
          `[TaskGenerationEngine] Assignment email failed for assignee ${assignee._id} on task ${task._id}:`,
          emailError.message,
        );
        allSucceeded = false;
      }
    }

    if (allSucceeded) {
      task.assignmentEmailSent = true;
      task.assignmentEmailSentAt = new Date();
      task.assignmentEmailStatus = "sent";
      task.assignmentEmailRetryCount = 0;
      task.assignmentEmailLastError = null;
      console.log(`[TaskGenerationEngine] Assignment email sent for task ${task._id}`);
    } else {
      task.assignmentEmailStatus = "failed";
      task.assignmentEmailRetryCount = (task.assignmentEmailRetryCount || 0) + 1;
      task.assignmentEmailLastError = "One or more assignee emails failed";
      console.log(`[TaskGenerationEngine] Assignment email failed for task ${task._id}`);
    }

    await task.save();
  } catch (error) {
    console.error(`[TaskGenerationEngine] sendAssignmentEmailForTask error for ${task._id}:`, error.message);
    task.assignmentEmailStatus = "failed";
    task.assignmentEmailRetryCount = (task.assignmentEmailRetryCount || 0) + 1;
    task.assignmentEmailLastError = error.message;
    await task.save().catch((saveErr) => {
      console.error(`[TaskGenerationEngine] Failed to save email status for task ${task._id}:`, saveErr.message);
    });
  }
}

/**
 * Retry pending/failed assignment emails.
 * Called every minute as part of the cron cycle.
 */
export async function sendPendingAssignmentEmails() {
  try {
    const MAX_RETRIES = 5;
    const tasks = await Task.find({
      assignmentEmailStatus: "failed",
      assignmentEmailRetryCount: { $lt: MAX_RETRIES },
    }).populate("assignedTo assignedBy");

    let sent = 0;
    for (const task of tasks) {
      try {
        await sendAssignmentEmailForTask(task);
        if (task.assignmentEmailStatus === "sent") sent++;
      } catch (err) {
        console.error(`[TaskGenerationEngine] Retry failed for task ${task._id}:`, err.message);
      }
    }

    if (sent > 0) {
      console.log(`[TaskGenerationEngine] Retried ${tasks.length} pending emails, ${sent} sent`);
    }
  } catch (error) {
    console.error("[TaskGenerationEngine] sendPendingAssignmentEmails failed:", error.message);
  }
}

/**
 * Calculate the occurrence date for a task based on template and generation time.
 * For non-Custom types, returns the scheduled IST time on the generation day.
 * For Custom types, returns the exact generation time.
 */
export function calculateOccurrenceDate(template, generationTime = new Date()) {
  if (template.taskType === "Custom") {
    return new Date(generationTime);
  }
  const { scheduledHour = 9, scheduledMinute = 0 } = template;
  const { year, month, day } = getKolkataDateParts(generationTime);
  return createKolkataDate(year, month, day, scheduledHour, scheduledMinute, 0);
}

/**
 * Calculate the deadline for a recurring task occurrence.
 * The deadline equals occurrenceDate + recurrence interval.
 * For calendar-based types, this matches the next scheduled occurrence time.
 */
export function calculateDeadline(occurrenceDate, taskType, recurrencePattern, anchorDom) {
  if (!occurrenceDate) return null;
  if (taskType === "One Time") return null;

  const base = new Date(occurrenceDate);

  if (taskType === "Custom") {
    const intervalValue = Number(
      recurrencePattern?.intervalValue ?? recurrencePattern?.interval ?? 1,
    );
    const intervalUnit = recurrencePattern?.intervalUnit || "Days";

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
        const { year, month, day, hour, minute } = getKolkataDateParts(base);
        return advanceByMonths("Custom", day, year, month, day, hour, minute, intervalValue);
      }
      default:
        return new Date(base.getTime() + 86400000);
    }
  }

  switch (taskType) {
    case "Daily":
      return new Date(base.getTime() + 86400000);
    case "Weekly":
      return new Date(base.getTime() + 604800000);
    case "Monthly":
    case "Quarterly":
    case "Half Yearly":
    case "Yearly": {
      const { year, month, day, hour, minute } = getKolkataDateParts(base);
      const effectiveAnchor = anchorDom ?? day;
      return advanceByMonths(taskType, effectiveAnchor, year, month, day, hour, minute);
    }
    default:
      return null;
  }
}

/**
 * Check if a template should generate a task now
 */
export function shouldGenerateTemplate(template, now = new Date()) {
  if (template.status === "Paused" || template.status === "Deleted") return false;
  if (!template.isActive) return false;
  if (!template.repeatForever && template.endDate && new Date(template.endDate) < now) return false;
  if (!template.nextGenerationDate) return false;
  return new Date(template.nextGenerationDate) <= now;
}

/**
 * Generate a single task occurrence from a template
 */
export async function generateTaskFromTemplate(template, occurrenceDate, occurrenceNumber) {
  try {
    const {
      title,
      description,
      priority,
      department,
      tags,
      assignedTo,
      assignedBy,
      category,
      taskType,
      recurrencePattern,
      defaultDeadlineHours,
      startDate: templateStartDate,
    } = template;

    // Deadline = occurrenceDate + recurrence interval
    // This ensures every generated task has a real due date
    const anchorDom = templateStartDate
      ? getKolkataDateParts(templateStartDate).day
      : undefined;
    const deadline = defaultDeadlineHours
      ? new Date(occurrenceDate.getTime() + defaultDeadlineHours * 3600000)
      : calculateDeadline(occurrenceDate, taskType, recurrencePattern, anchorDom);

    // Generate occurrence name
    const taskTitle = generateOccurrenceName(title, taskType, occurrenceDate, recurrencePattern);

    // Build assignee progress
    const assigneeProgress = buildAssigneeProgress(assignedTo);

    // Build reminder state for each assignee
    const reminderState = assignedTo.map((assigneeId) =>
      createReminderStateEntry(
        assigneeId,
        {
          taskType,
          recurrencePattern,
          deadline,
          status: "In Progress",
        },
        new Date(),
      ),
    );

    // Create task data
    const taskData = {
      title: taskTitle,
      description,
      priority,
      status: "In Progress",
      deadline,
      assignedTo,
      assignedBy,
      department,
      tags,
      category,
      taskType,
      recurrencePattern,
      templateId: template._id,
      occurrenceDate,
      occurrenceNumber,
      generatedAt: new Date(),
      generatedByCron: true,
      isGeneratedOccurrence: true,
      isRecurring: false,
      assigneeProgress,
      reminderState,
      emailSchedule: createEmailSchedule(taskType, new Date()),
      history: [
        {
          status: "In Progress",
          changedBy: assignedBy,
          note: "Task generated from recurring template",
        },
      ],
    };

    // Create the task
    const task = await Task.create(taskData);

    // Create conversation
    let assignMessage = null;
    try {
      assignMessage = await notifyTaskAssigned(
        task._id,
        assignedBy,
        assignedTo.map((id) => {
          const user = assignedTo.find(a => a._id?.toString() === id.toString() || a.toString() === id.toString());
          return user?.name || id.toString();
        }).join(", "),
      );
    } catch (e) {
      console.error("Failed to create system message:", e);
    }

    let assignConversation = null;
    if (assignMessage) {
      try {
        assignConversation = await Conversation.findOne({ taskId: task._id })
          .select("_id")
          .lean();
      } catch (e) {
        console.error("Failed to find conversation:", e);
      }
    }

    // Create notifications
    const notifications = assignedTo.map((assigneeId) => ({
      recipient: assigneeId,
      sender: assignedBy,
      title: "New Task Assigned",
      message: `You have been assigned a new task: "${taskTitle}"`,
      type: "task_assigned",
      entityId: task._id,
      entityType: "Task",
      actionUrl: buildActionUrl(task._id, assignMessage?._id),
      conversationId: assignConversation?._id,
      messageId: assignMessage?._id,
    }));
    await Notification.insertMany(notifications);

    // Create activity log
    await Activity.create({
      user: assignedBy,
      type: "task_created",
      description: `Recurring task "${taskTitle}" generated from template`,
      entityId: task._id,
      entityType: "Task",
      metadata: {
        templateId: template._id,
        occurrenceNumber,
        generatedByCron: true,
      },
    });

    // Send assignment email immediately (non-blocking for generation success)
    // Email failure is logged and stored on the task; it never rolls back the task.
    try {
      await sendAssignmentEmailForTask(task);
    } catch (emailError) {
      console.error(`[TaskGenerationEngine] Assignment email send failed for task ${task._id}:`, emailError.message);
    }

    console.log(`[TaskGenerationEngine] Recurring task generated — ${taskTitle} (occurrence ${occurrenceNumber})`);
    return task;
  } catch (error) {
    console.error("[TaskGenerationEngine] Failed to generate task from template:", error);
    throw error;
  }
}

/**
 * Update template after successful task generation
 */
export async function updateTemplateAfterGeneration(template) {
  try {
    const now = new Date();
    const nextDate = calculateNextGenerationDate(template, now);
    
    template.lastGeneratedDate = now;
    template.generatedCount = (template.generatedCount || 0) + 1;
    template.nextGenerationDate = nextDate;
    
    await template.save();
    return template;
  } catch (error) {
    console.error("[TaskGenerationEngine] Failed to update template:", error);
    throw error;
  }
}

/**
 * Generate all due tasks from active templates
 * This is the main function called by cron
 *
 * Uses atomic findOneAndUpdate to claim each template before generating,
 * preventing duplicate generation from concurrent cron invocations.
 */
export async function generateDueTasks() {
  try {
    const now = new Date();

    // Find all active templates that are due for generation
    // repeatForever=true templates always generate; others only if endDate hasn't passed
    const dueTemplates = await RecurringTemplate.find({
      status: "Active",
      isActive: true,
      nextGenerationDate: { $lte: now },
      $or: [
        { repeatForever: true },
        { endDate: { $exists: false } },
        { endDate: { $gte: now } },
      ],
    }).populate("assignedTo assignedBy");

    // Self-heal: deactivate orphan templates whose master task no longer exists
    if (dueTemplates.length > 0) {
      const templateIds = dueTemplates.map(t => t._id);
      const masterTasks = await Task.find({
        templateId: { $in: templateIds },
        isRecurring: true,
      }).select("templateId").lean();
      const validIds = new Set(masterTasks.map(t => t.templateId.toString()));

      for (let i = dueTemplates.length - 1; i >= 0; i--) {
        if (!validIds.has(dueTemplates[i]._id.toString())) {
          console.log(`[TaskGenerationEngine] Orphan template ${dueTemplates[i]._id} (master task missing). Deactivating.`);
          await RecurringTemplate.updateOne({ _id: dueTemplates[i]._id }, { isActive: false });
          dueTemplates.splice(i, 1);
        }
      }
    }

    let generatedCount = 0;
    const errors = [];

    for (const template of dueTemplates) {
      try {
        // Check if template should generate
        if (!shouldGenerateTemplate(template, now)) {
          continue;
        }

        // ATOMIC GUARD: Atomically claim this template by advancing nextGenerationDate
        // to a far-future sentinel. Only one cron cycle can claim it.
        // If another process already claimed it, findOneAndUpdate returns null.
        const sentinelDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const claimed = await RecurringTemplate.findOneAndUpdate(
          {
            _id: template._id,
            nextGenerationDate: template.nextGenerationDate,
            status: "Active",
          },
          { $set: { nextGenerationDate: sentinelDate } },
          { new: true },
        );

        if (!claimed) {
          // Another process already claimed this template
          console.log(`[TaskGenerationEngine] Template ${template._id} already claimed by another process, skipping`);
          continue;
        }

        // Calculate occurrence details
        const occurrenceDate = calculateOccurrenceDate(template, now);
        const occurrenceNumber = (template.generatedCount || 0) + 1;

        // Generate the task
        await generateTaskFromTemplate(template, occurrenceDate, occurrenceNumber);

        // Update template with actual next generation date
        const realNextDate = calculateNextGenerationDate(template, now);
        template.lastGeneratedDate = now;
        template.generatedCount = (template.generatedCount || 0) + 1;
        template.nextGenerationDate = realNextDate;

        await RecurringTemplate.updateOne(
          { _id: template._id },
          {
            $set: {
              lastGeneratedDate: now,
              nextGenerationDate: realNextDate,
              generatedCount: (template.generatedCount || 0) + 1,
            },
          },
        );

        generatedCount++;
      } catch (error) {
        console.error(`[TaskGenerationEngine] Failed to generate task for template ${template._id}:`, error);
        errors.push({
          templateId: template._id,
          error: error.message,
        });

        // Restore nextGenerationDate if it was claimed but generation failed
        try {
          const fallbackNext = calculateNextGenerationDate(template, now);
          await RecurringTemplate.updateOne(
            { _id: template._id },
            { $set: { nextGenerationDate: fallbackNext } },
          );
        } catch (restoreError) {
          console.error(`[TaskGenerationEngine] Failed to restore nextGenerationDate for template ${template._id}:`, restoreError);
        }
      }
    }

    console.log(`[TaskGenerationEngine] Generated ${generatedCount} tasks from ${dueTemplates.length} due templates`);
    if (errors.length > 0) {
      console.error(`[TaskGenerationEngine] ${errors.length} errors occurred:`, errors);
    }

    return {
      generatedCount,
      totalTemplates: dueTemplates.length,
      errors,
    };
  } catch (error) {
    console.error("[TaskGenerationEngine] Failed to generate due tasks:", error);
    throw error;
  }
}

/**
 * Find generated tasks that still need assignment emails (pending or failed)
 */
export async function findTasksNeedingAssignmentEmail() {
  try {
    const tasks = await Task.find({
      generatedByCron: true,
      assignmentEmailSent: { $ne: true },
      assignmentEmailStatus: { $in: ["pending", "failed"] },
    }).populate("assignedTo assignedBy");

    return tasks;
  } catch (error) {
    console.error("[TaskGenerationEngine] Failed to find tasks needing assignment email:", error);
    throw error;
  }
}
