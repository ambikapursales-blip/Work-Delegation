import mongoose from "mongoose";
import Task from "../models/Task.js";
import User from "../models/User.js";
import RecurringTemplate from "../models/RecurringTemplate.js";
import {
  shouldSendEmailToday,
  updateEmailSchedule,
} from "./emailFrequencyEngine.js";
import {
  ensureReminderState,
  getReminderMode,
  shouldSendReminder,
  updateReminderStateAfterSend,
  markDeadlineMilestoneSent,
  shouldSendDeadlineMilestone,
  markReminderPaused,
} from "./reminderEngine.js";
import {
  generateDueTasks,
  recalculateAllTemplateDates,
  sendPendingAssignmentEmails,
  sendAssignmentEmailForTask,
} from "./taskGenerationEngine.js";
import { isRecurringTaskOverdue } from "./overdueEngine.js";
import { buildRecurringSummary } from "./recurringSummaryBuilder.js";
import { sendRecurringSummaryEmail } from "./emailService.js";
import { getKolkataDateParts, createKolkataDate, getKolkataDayOfWeek } from "./istTime.js";
import { generateCompleteToken } from "./completeToken.js";
import { generateCommentToken } from "./commentToken.js";
import { generateExtensionToken } from "./extensionToken.js";
import { EMAIL_CONFIG } from "../config/email.js";

// The 6 recurring task types that are batched into summary emails
const RECURRING_TASK_TYPES = [
  "Daily", "Weekly", "Monthly", "Quarterly", "Half Yearly", "Yearly",
];

// Legacy function kept for backward compatibility during migration
// Will be removed after migration is complete
const generateNextTaskOccurrence = async (parentTask) => {
  try {
    const {
      recurrencePattern,
      recurrenceEndDate,
      assignedTo,
      assignedBy,
      title,
      description,
      priority,
      department,
      tags,
    } = parentTask;

    if (recurrenceEndDate && new Date() > recurrenceEndDate) {
      return null;
    }

    const baseDate = new Date(parentTask.nextOccurrenceDate || new Date());
    let nextDeadline = new Date(baseDate);

    if (recurrencePattern.frequency === "daily") {
      nextDeadline.setDate(
        nextDeadline.getDate() + (recurrencePattern.interval || 1),
      );
    } else if (recurrencePattern.frequency === "weekly") {
      nextDeadline.setDate(
        nextDeadline.getDate() + 7 * (recurrencePattern.interval || 1),
      );
    } else if (recurrencePattern.frequency === "biweekly") {
      nextDeadline.setDate(nextDeadline.getDate() + 14);
    } else if (recurrencePattern.frequency === "monthly") {
      nextDeadline.setMonth(
        nextDeadline.getMonth() + (recurrencePattern.interval || 1),
      );
      if (recurrencePattern.dayOfMonth) {
        nextDeadline.setDate(recurrencePattern.dayOfMonth);
      }
    }

    const newTask = new Task({
      title: `${title} (Recurring)`,
      description,
      priority,
      status: "In Progress",
      deadline: nextDeadline,
      assignedTo,
      assignedBy,
      department,
      tags,
      parentTaskId: parentTask._id,
      taskType: parentTask.taskType,
      isRecurring: false,
    });

    const savedTask = await newTask.save();

    parentTask.lastGeneratedDate = new Date();
    parentTask.nextOccurrenceDate = nextDeadline;
    await parentTask.save();

    return savedTask;
  } catch (error) {
    console.error(
      "[CronJobs] generateNextTaskOccurrence failed:",
      error.message,
    );
  }
};

// Legacy function kept for backward compatibility during migration
// Will be removed after migration is complete
const generateRecurringTasksLegacy = async () => {
  try {
    const recurringTasks = await Task.find({
      isRecurring: true,
      taskType: { $ne: "One-time" },
      $or: [
        { recurrenceEndDate: { $gt: new Date() } },
        { recurrenceEndDate: { $exists: false } },
      ],
    }).populate("assignedTo assignedBy");

    for (const task of recurringTasks) {
      const lastGenerated = task.lastGeneratedDate || task.createdAt;
      const now = new Date();

      let shouldGenerate = false;

      if (task.recurrencePattern.frequency === "daily") {
        const daysDiff = Math.floor(
          (now - lastGenerated) / (1000 * 60 * 60 * 24),
        );
        shouldGenerate = daysDiff >= (task.recurrencePattern.interval || 1);
      } else if (task.recurrencePattern.frequency === "weekly") {
        const daysDiff = Math.floor(
          (now - lastGenerated) / (1000 * 60 * 60 * 24),
        );
        shouldGenerate = daysDiff >= 7 * (task.recurrencePattern.interval || 1);
      } else if (task.recurrencePattern.frequency === "biweekly") {
        const daysDiff = Math.floor(
          (now - lastGenerated) / (1000 * 60 * 60 * 24),
        );
        shouldGenerate = daysDiff >= 14;
      } else if (task.recurrencePattern.frequency === "monthly") {
        const monthsDiff =
          (now.getFullYear() - lastGenerated.getFullYear()) * 12 +
          (now.getMonth() - lastGenerated.getMonth());
        shouldGenerate = monthsDiff >= (task.recurrencePattern.interval || 1);
      }

      if (shouldGenerate) {
        await generateNextTaskOccurrence(task);
      }
    }

    const completedChildTasks = await Task.find({
      parentTaskId: { $exists: true, $ne: null },
      status: "Completed",
    }).populate("parentTaskId");

    for (const childTask of completedChildTasks) {
      const parentTask = childTask.parentTaskId;

      if (
        parentTask &&
        parentTask.isRecurring &&
        parentTask.taskType !== "One-time"
      ) {
        const pendingSiblings = await Task.findOne({
          parentTaskId: parentTask._id,
          status: { $nin: ["Completed", "Cancelled"] },
        });

        if (!pendingSiblings) {
          await generateNextTaskOccurrence(parentTask);
        }
      }
    }
  } catch (error) {
    console.error("[CronJobs] generateRecurringTasksLegacy failed:", error.message);
  }
};

// NEW: Generate recurring tasks from RecurringTemplate model
// This replaces the old Task-based generation
const generateRecurringTasks = async () => {
  const lockAcquired = await acquireGenerationLock();
  if (!lockAcquired) {
    return;
  }

  try {
    // Use the new task generation engine
    const result = await generateDueTasks();
    console.log(`[CronJobs] Generated ${result.generatedCount} tasks from ${result.totalTemplates} templates`);
    return result;
  } catch (error) {
    console.error("[CronJobs] generateRecurringTasks failed:", error.message);
    // Fallback to legacy if new engine fails during migration
    console.log("[CronJobs] Falling back to legacy generation");
    await generateRecurringTasksLegacy();
  } finally {
    await releaseGenerationLock();
  }
};

// ── Distributed lock for sendAssignmentEmailsForNewTasks ──

const ASSIGNMENT_FALLBACK_LOCK_KEY = "assignment_fallback";
const ASSIGNMENT_FALLBACK_LOCK_TTL_MS = 10 * 60 * 1000;

const acquireAssignmentFallbackLock = async () => {
  try {
    await ensureMongoConnection();
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + ASSIGNMENT_FALLBACK_LOCK_TTL_MS);

    const result = await locks.findOneAndUpdate(
      {
        _id: ASSIGNMENT_FALLBACK_LOCK_KEY,
        $or: [
          { lockedAt: { $exists: false } },
          { lockedAt: { $lt: new Date(now.getTime() - ASSIGNMENT_FALLBACK_LOCK_TTL_MS) } },
        ],
      },
      {
        $set: { lockedAt: now, expiresAt: lockExpiry },
        $setOnInsert: { _id: ASSIGNMENT_FALLBACK_LOCK_KEY },
      },
      { upsert: true, returnDocument: "after" },
    );

    const doc = result && result.value ? result.value : result;
    if (doc && doc.lockedAt && doc.lockedAt.getTime() === now.getTime()) {
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 11000) return false;
    console.error("[CronJobs] Failed to acquire assignment fallback lock:", error);
    return false;
  }
};

const releaseAssignmentFallbackLock = async () => {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    await locks.deleteOne({ _id: ASSIGNMENT_FALLBACK_LOCK_KEY });
  } catch (error) {
    console.error("[CronJobs] Failed to release assignment fallback lock:", error);
  }
};

// Send assignment emails for tasks that still need them (fallback for retries).
// Most tasks get their assignment email immediately during generation;
// this cron catches any where the email is still pending or failed.
const sendAssignmentEmailsForNewTasks = async () => {
  const lockAcquired = await acquireAssignmentFallbackLock();
  if (!lockAcquired) return;

  try {
    const now = new Date();
    const tasks = await Task.find({
      generatedByCron: true,
      assignmentEmailSent: { $ne: true },
      assignmentEmailStatus: { $in: ["pending", "failed"] },
      assignmentEmailRetryCount: { $lt: EMAIL_CONFIG.retry.maxRetries },
      $or: [
        { assignmentEmailNextAttemptAt: null },
        { assignmentEmailNextAttemptAt: { $lte: now } },
      ],
    }).populate("assignedTo assignedBy");

    let emailsSent = 0;

    for (const task of tasks) {
      // Recurring task types get consolidated summary emails instead
      if (RECURRING_TASK_TYPES.includes(task.taskType)) {
        task.assignmentEmailSent = true;
        task.assignmentEmailStatus = "skipped";
        task.assignmentEmailClaimedAt = null;
        await task.save().catch(() => {});
        continue;
      }

      // Delegate to the shared engine so claim/retry/backoff handling is
      // identical across the 1-minute retry loop and this fallback cron.
      try {
        await sendAssignmentEmailForTask(task);
        if (task.assignmentEmailStatus === "sent") emailsSent++;
      } catch (emailError) {
        console.error(
          "[CronJobs] Failed to send assignment email for generated task:",
          emailError.message,
        );
      }
    }

    if (emailsSent > 0) {
      console.log(`[CronJobs] Sent ${emailsSent} assignment emails (fallback cron)`);
    }
  } catch (error) {
    console.error("[CronJobs] sendAssignmentEmailsForNewTasks failed:", error.message);
  } finally {
    await releaseAssignmentFallbackLock();
  }
};

const sendDeadlineAlerts = async () => {
  const { hour } = getKolkataDateParts(new Date());
  if (hour !== 9) {
    return;
  }

  const lockAcquired = await acquireDeadlineAlertLock();
  if (!lockAcquired) {
    return;
  }

  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeTasks = await Task.find({
      status: { $nin: ["Completed", "Cancelled", "Overdue"] },
      deadline: { $exists: true, $ne: null },
      $or: [
        { isRecurring: { $ne: true } },
        { isGeneratedOccurrence: true },
      ],
    }).populate("assignedTo assignedBy");

    let alertsSent = 0;

    for (const task of activeTasks) {
      // Suppress milestone deadline alerts for the 6 recurring task types.
      // They are delivered via the daily/weekly summary emails instead.
      if (RECURRING_TASK_TYPES.includes(task.taskType)) {
        continue;
      }

      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];

      for (const assignee of assignees) {
        if (!assignee?.email) continue;

        const reminderState = ensureReminderState(task, assignee._id, now);
        if (shouldSendDeadlineMilestone(task, reminderState, now)) {
          const milestoneKey = Object.entries({
            4: "fourDays",
            3: "threeDays",
            2: "twoDays",
            1: "oneDay",
            0: "dueToday",
          }).find(([days]) => {
            const deadlineDate = new Date(task.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            const diffTime = deadlineDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return Number(days) === daysRemaining;
          })?.[1];

          if (milestoneKey) {
            try {
              const assigneeUserId = String(assignee._id);
              const taskId = String(task._id);
              const completeToken = generateCompleteToken(taskId, assigneeUserId);
              const commentToken = generateCommentToken(taskId, assigneeUserId);
              const extensionToken = generateExtensionToken(taskId, assigneeUserId);

              const baseDetails = {
                title: task.title,
                description: task.description,
                deadline: task.deadline,
                priority: task.priority,
                assignedBy: task.assignedBy?.name || "Unknown",
                assignedTo: assignee.name,
                taskType: task.taskType,
                createdAt: task.createdAt,
                taskId: task._id,
                userId: assignee._id,
                status: task.status,
                completeToken,
                commentToken,
                extensionToken,
              };

              // DISABLED: Reminder and Due Today Emails per new email policy
              // if (milestoneKey === "dueToday") {
              //   await sendTaskDueTodayEmail(assignee.email, assignee.name, baseDetails);
              // } else {
              //   await sendTaskReminderEmail(assignee.email, assignee.name, baseDetails);
              // }
              alertsSent++;
            } catch (emailError) {
              console.error(
                "[CronJobs] Failed to send deadline alert:",
                emailError.message,
              );
            }

            await Task.updateOne(
              { _id: task._id, "reminderState.user": assignee._id },
              {
                $set: {
                  "reminderState.$.milestoneFlags": markDeadlineMilestoneSent(reminderState, milestoneKey).milestoneFlags,
                  "reminderState.$.lastReminderType": "normal",
                  "reminderState.$.lastEmailTemplate": milestoneKey === "dueToday" ? "dueToday" : "reminder",
                },
              },
            );
          }
        }
      }
    }

    console.log(`[CronJobs] Sent ${alertsSent} deadline alerts`);
  } catch (error) {
    console.error("[CronJobs] sendDeadlineAlerts failed:", error.message);
  } finally {
    await releaseDeadlineAlertLock();
  }
};

let mongoConnectionPromise = null;

const ensureMongoConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    });
  }

  return mongoConnectionPromise;
};

// ── Distributed lock for processScheduledEmails ──────────────

const REMINDER_LOCK_KEY = "process_reminders";
const REMINDER_LOCK_TTL_MS = 2 * 60 * 1000;

const acquireReminderLock = async () => {
  try {
    await ensureMongoConnection();
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + REMINDER_LOCK_TTL_MS);

    const result = await locks.findOneAndUpdate(
      {
        _id: REMINDER_LOCK_KEY,
        $or: [
          { lockedAt: { $exists: false } },
          {
            lockedAt: {
              $lt: new Date(now.getTime() - REMINDER_LOCK_TTL_MS),
            },
          },
        ],
      },
      {
        $set: { lockedAt: now, expiresAt: lockExpiry },
        $setOnInsert: { _id: REMINDER_LOCK_KEY },
      },
      { upsert: true, returnDocument: "after" },
    );

    const doc = result && result.value ? result.value : result;
    if (
      doc &&
      doc.lockedAt &&
      doc.lockedAt.getTime() === now.getTime()
    ) {
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 11000) {
      return false;
    }
    console.error("[CronJobs] Failed to acquire reminder lock:", error);
    return false;
  }
};

const releaseReminderLock = async () => {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    await locks.deleteOne({ _id: REMINDER_LOCK_KEY });
  } catch (error) {
    console.error("[CronJobs] Failed to release reminder lock:", error);
  }
};

// ── Distributed lock for generateRecurringTasks ────────────────

const GENERATION_LOCK_KEY = "task_generation";
const GENERATION_LOCK_TTL_MS = 10 * 60 * 1000;

const acquireGenerationLock = async () => {
  try {
    await ensureMongoConnection();
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + GENERATION_LOCK_TTL_MS);

    const result = await locks.findOneAndUpdate(
      {
        _id: GENERATION_LOCK_KEY,
        $or: [
          { lockedAt: { $exists: false } },
          {
            lockedAt: {
              $lt: new Date(now.getTime() - GENERATION_LOCK_TTL_MS),
            },
          },
        ],
      },
      {
        $set: { lockedAt: now, expiresAt: lockExpiry },
        $setOnInsert: { _id: GENERATION_LOCK_KEY },
      },
      { upsert: true, returnDocument: "after" },
    );

    const doc = result && result.value ? result.value : result;
    if (
      doc &&
      doc.lockedAt &&
      doc.lockedAt.getTime() === now.getTime()
    ) {
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 11000) {
      return false;
    }
    console.error("[CronJobs] Failed to acquire generation lock:", error);
    return false;
  }
};

const releaseGenerationLock = async () => {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    await locks.deleteOne({ _id: GENERATION_LOCK_KEY });
  } catch (error) {
    console.error("[CronJobs] Failed to release generation lock:", error);
  }
};

// ── Distributed lock for sendDeadlineAlerts ────────────────────

const DEADLINE_ALERT_LOCK_KEY = "deadline_alerts";
const DEADLINE_ALERT_LOCK_TTL_MS = 2 * 60 * 1000;

const acquireDeadlineAlertLock = async () => {
  try {
    await ensureMongoConnection();
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + DEADLINE_ALERT_LOCK_TTL_MS);

    const result = await locks.findOneAndUpdate(
      {
        _id: DEADLINE_ALERT_LOCK_KEY,
        $or: [
          { lockedAt: { $exists: false } },
          {
            lockedAt: {
              $lt: new Date(now.getTime() - DEADLINE_ALERT_LOCK_TTL_MS),
            },
          },
        ],
      },
      {
        $set: { lockedAt: now, expiresAt: lockExpiry },
        $setOnInsert: { _id: DEADLINE_ALERT_LOCK_KEY },
      },
      { upsert: true, returnDocument: "after" },
    );

    const doc = result && result.value ? result.value : result;
    if (
      doc &&
      doc.lockedAt &&
      doc.lockedAt.getTime() === now.getTime()
    ) {
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 11000) {
      return false;
    }
    console.error("[CronJobs] Failed to acquire deadline alert lock:", error);
    return false;
  }
};

const releaseDeadlineAlertLock = async () => {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    await locks.deleteOne({ _id: DEADLINE_ALERT_LOCK_KEY });
  } catch (error) {
    console.error("[CronJobs] Failed to release deadline alert lock:", error);
  }
};

const processScheduledEmails = async () => {
  const lockAcquired = await acquireReminderLock();
  if (!lockAcquired) {
    return;
  }

  try {
    await ensureMongoConnection();
    const now = new Date();

    const tasksNeedingEmails = await Task.find({
      status: { $nin: ["Completed", "Cancelled"] },
      $or: [
        { isRecurring: { $ne: true } },
        { isGeneratedOccurrence: true },
      ],
    }).populate("assignedTo assignedBy");

    let processedCount = 0;

    for (const task of tasksNeedingEmails) {
      // Suppress individual reminder/overdue emails for the 6 recurring task types.
      // They are delivered via the daily/weekly summary emails instead.
      if (RECURRING_TASK_TYPES.includes(task.taskType)) {
        continue;
      }

      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];

      for (const assignee of assignees) {
        if (!assignee?.email) continue;

        const reminderState = ensureReminderState(task, assignee._id, now);
        const mode = getReminderMode(task, now);
        const shouldSend = shouldSendReminder(task, reminderState, now);
        if (!shouldSend) {
          continue;
        }

        try {
          const assigneeUserId = String(assignee._id);
          const taskId = String(task._id);
          const completeToken = generateCompleteToken(taskId, assigneeUserId);
          const commentToken = generateCommentToken(taskId, assigneeUserId);
          const extensionToken = generateExtensionToken(taskId, assigneeUserId);

          const baseDetails = {
            title: task.title,
            description: task.description,
            deadline: task.deadline,
            priority: task.priority,
            assignedBy: task.assignedBy?.name || "Unknown",
            assignedTo: assignee.name,
            taskType: task.taskType,
            createdAt: task.createdAt,
            taskId: task._id,
            userId: assignee._id,
            status: task.status,
            completeToken,
            commentToken,
            extensionToken,
          };

          // DISABLED: Reminder and Overdue Alert Emails per new email policy
          // if (mode === "overdue") {
          //   const overdueSince = task.deadline || task.occurrenceDate;
          //   const daysOverdue = overdueSince
          //     ? Math.ceil((now.getTime() - new Date(overdueSince).getTime()) / (1000 * 60 * 60 * 24))
          //     : 0;

          //   await sendTaskOverdueAlertEmail(assignee.email, assignee.name, {
          //     ...baseDetails,
          //     deadline: task.deadline || task.occurrenceDate,
          //     daysOverdue,
          //   });
          // } else {
          //   await sendTaskReminderEmail(assignee.email, assignee.name, baseDetails);
          // }

          const updatedState = updateReminderStateAfterSend(
            task,
            reminderState,
            now,
            mode,
          );
          await Task.updateOne(
            { _id: task._id, "reminderState.user": assignee._id },
            { $set: { "reminderState.$": updatedState } },
          );
          processedCount++;
        } catch (emailError) {
          console.error(
            "[CronJobs] Failed to send scheduled reminder:",
            emailError.message,
          );
        }
      }

    }

    console.log(`[CronJobs] Processed ${processedCount} reminder emails`);

    // Retry pending assignment emails for previously generated tasks
    await sendPendingAssignmentEmails();

    // Run recurring task generation on the same 1-minute cadence
    await generateDueTasks();

    // Unified overdue check: tasks whose deadline has passed
    // Plus fallback for pre-migration tasks without a deadline (occurrenceDate-based)
    const overdueCandidates = await Task.find({
      status: { $nin: ["Completed", "Cancelled", "Overdue"] },
      $and: [
        {
          $or: [
            { deadline: { $lt: now } },
            {
              isGeneratedOccurrence: true,
              deadline: null,
              occurrenceDate: { $exists: true, $ne: null },
            },
          ],
        },
        {
          $or: [
            { isRecurring: { $ne: true } },
            { isGeneratedOccurrence: true },
          ],
        },
      ],
    }).select("_id deadline occurrenceDate taskType recurrencePattern isGeneratedOccurrence status").lean();

    const overdueIds = overdueCandidates
      .filter((t) => isRecurringTaskOverdue(t, now))
      .map((t) => t._id);

    if (overdueIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: overdueIds } },
        { status: "Overdue", isOverdue: true },
      );
      console.log(`[CronJobs] Marked ${overdueIds.length} tasks as Overdue`);
    }
  } catch (error) {
    console.error("[CronJobs] processScheduledEmails failed:", error.message);
  } finally {
    await releaseReminderLock();
  }
};

// ── Distributed lock for processOverdueTasks ─────────────

const OVERDUE_LOCK_KEY = "overdue_tasks";
const OVERDUE_LOCK_TTL_MS = 10 * 60 * 1000;

const acquireOverdueLock = async () => {
  try {
    await ensureMongoConnection();
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + OVERDUE_LOCK_TTL_MS);

    const result = await locks.findOneAndUpdate(
      {
        _id: OVERDUE_LOCK_KEY,
        $or: [
          { lockedAt: { $exists: false } },
          { lockedAt: { $lt: new Date(now.getTime() - OVERDUE_LOCK_TTL_MS) } },
        ],
      },
      {
        $set: { lockedAt: now, expiresAt: lockExpiry },
        $setOnInsert: { _id: OVERDUE_LOCK_KEY },
      },
      { upsert: true, returnDocument: "after" },
    );

    const doc = result && result.value ? result.value : result;
    if (doc && doc.lockedAt && doc.lockedAt.getTime() === now.getTime()) {
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 11000) return false;
    console.error("[CronJobs] Failed to acquire overdue lock:", error);
    return false;
  }
};

const releaseOverdueLock = async () => {
  try {
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    await locks.deleteOne({ _id: OVERDUE_LOCK_KEY });
  } catch (error) {
    console.error("[CronJobs] Failed to release overdue lock:", error);
  }
};

const processOverdueTasks = async () => {
  const lockAcquired = await acquireOverdueLock();
  if (!lockAcquired) return;

  try {
    const now = new Date();

    // Unified overdue query: deadline-based + occurrenceDate-based fallback
    const overdueCandidates = await Task.find({
      status: { $nin: ["Completed", "Cancelled", "Overdue"] },
      $and: [
        {
          $or: [
            { deadline: { $lt: now } },
            {
              isGeneratedOccurrence: true,
              deadline: null,
              occurrenceDate: { $exists: true, $ne: null },
            },
          ],
        },
        {
          $or: [
            { isRecurring: { $ne: true } },
            { isGeneratedOccurrence: true },
          ],
        },
      ],
    }).populate("assignedTo");

    const allOverdueTasks = overdueCandidates.filter((t) =>
      isRecurringTaskOverdue(t, now),
    );
    const allTaskIds = allOverdueTasks.map((task) => task._id);

    if (allTaskIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: allTaskIds } },
        { status: "Overdue", isOverdue: true },
      );
      console.log(`[CronJobs] Marked ${allTaskIds.length} tasks as Overdue`);
    }

    // Group overdue tasks by user — only for non-recurring (One-Time/Custom)
    const userOverdueMap = new Map();

    for (const task of allOverdueTasks) {
      // Skip recurring task types; their communication is handled by the
      // daily/weekly summary crons.
      if (RECURRING_TASK_TYPES.includes(task.taskType)) {
        continue;
      }

      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];

      for (const assignee of assignees) {
        if (assignee && assignee.email) {
          const userId = assignee._id.toString();
          if (!userOverdueMap.has(userId)) {
            userOverdueMap.set(userId, {
              user: assignee,
              count: 0,
            });
          }
          userOverdueMap.get(userId).count++;
        }
      }
    }

    // Send one summary email per user (only for non-recurring overdue tasks)
    // DISABLED: Overdue Summary Email per new email policy
    // let emailsSent = 0;
    // for (const [userId, { user, count }] of userOverdueMap) {
    //   if (user && user.email && count > 0) {
    //     try {
    //       await sendOverdueTasksSummaryEmail(user.email, user.name, count);
    //       emailsSent++;
    //     } catch (emailError) {
    //       console.error(
    //         "[CronJobs] Failed to send overdue summary email:",
    //         emailError.message,
    //       );
    //     }
    //   }
    // }

    // if (emailsSent > 0) {
    //   console.log(`[CronJobs] Sent ${emailsSent} overdue summary emails (non-recurring only)`);
    // }
  } catch (error) {
    console.error("[CronJobs] processOverdueTasks failed:", error.message);
  } finally {
    await releaseOverdueLock();
  }
};

// ── Once-per-period completion locks for the recurring summary jobs ──
// Extends the existing cron_locks architecture: the marker document for
// a reporting period is created exactly once (insert-if-absent) and left
// in place, so repeated production route triggers within the same
// reporting period can never re-send. Periods are IST-scoped:
//   daily       → daily_recurring_summary:<YYYY-MM-DD>
//   weekly      → weekly_recurring_summary:<YYYY-MM-DD> (IST Monday)
//   management  → daily_management_summary:<YYYY-MM-DD>
// Concurrency is still guaranteed: MongoDB permits only one successful
// insert per _id, so a concurrent trigger loses the upsert race.

const SUMMARY_LOCK_NAMESPACES = {
  daily: "daily_recurring_summary",
  weekly: "weekly_recurring_summary",
  management: "daily_management_summary",
};

const formatISTDateKey = (date) => {
  const { year, month, day } = getKolkataDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const acquireSummaryPeriodLock = async (jobType, istDateKey) => {
  const lockId = `${SUMMARY_LOCK_NAMESPACES[jobType]}:${istDateKey}`;
  try {
    await ensureMongoConnection();
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    const now = new Date();

    const result = await locks.findOneAndUpdate(
      { _id: lockId },
      {
        $setOnInsert: {
          _id: lockId,
          lockedAt: now,
          completedAt: null,
        },
      },
      { upsert: true, returnDocument: "before" },
    );

    const doc = result && result.value ? result.value : result;
    return !doc;
  } catch (error) {
    if (error.code === 11000) return false;
    console.error(`[CronJobs] Failed to acquire ${lockId}:`, error);
    return false;
  }
};

const completeSummaryPeriodLock = async (jobType, istDateKey) => {
  const lockId = `${SUMMARY_LOCK_NAMESPACES[jobType]}:${istDateKey}`;
  try {
    const db = mongoose.connection.db;
    const locks = db.collection("cron_locks");
    await locks.updateOne({ _id: lockId }, { $set: { completedAt: new Date() } });
  } catch (error) {
    console.error(`[CronJobs] Failed to complete ${lockId}:`, error);
  }
};

// ── IST Date helpers ───────────────────────────────────────────
// All boundary functions use the istTime helpers so that "today"
// means the IST day (midnight-to-midnight in Asia/Kolkata), not
// the server's local timezone. This ensures tasks created or
// completed at IST boundaries are correctly attributed.

const startOfDayIST = (date) => {
  const { year, month, day } = getKolkataDateParts(date);
  return createKolkataDate(year, month, day, 0, 0, 0);
};

const endOfDayIST = (date) => {
  const { year, month, day } = getKolkataDateParts(date);
  return createKolkataDate(year, month, day, 23, 59, 59, 999);
};

const startOfWeekIST = (date) => {
  const { year, month, day } = getKolkataDateParts(date);
  // Use the IST weekday (0=Sun, 6=Sat) to avoid getDay() which would
  // use the runtime's local timezone.
  const dow = getKolkataDayOfWeek(date);
  const diff = day - dow + (dow === 0 ? -6 : 1); // to Monday
  return createKolkataDate(year, month, diff, 0, 0, 0);
};

/**
 * SendDailyRecurringSummary — runs daily at 9:00 AM IST.
 *
 * Sends one email per user with:
 *   • Today's New Tasks
 *   • Yesterday Completed
 *   • Overdue Tasks
 *   • Total Active Tasks
 * followed by task cards (max 20, with "+X more" link if truncated).
 */
const sendDailyRecurringSummary = async () => {
  const now = new Date();
  const { hour } = getKolkataDateParts(now);
  if (hour !== 9) {
    return;
  }
  const istDateKey = formatISTDateKey(now);

  const lockAcquired = await acquireSummaryPeriodLock("daily", istDateKey);
  if (!lockAcquired) return;

  try {
    await ensureMongoConnection();

    const { year: y, month: m, day: d } = getKolkataDateParts(now);
    const todayStart = startOfDayIST(now);
    const todayEnd = endOfDayIST(now);
    // Yesterday = 1ms before IST midnight today gives IST 23:59:59.999 of yesterday
    const todayMidnightIST = createKolkataDate(y, m, d, 0, 0, 0);
    const yesterdayEnd = new Date(todayMidnightIST.getTime() - 1);
    const yesterdayStart = startOfDayIST(yesterdayEnd);

    const perUser = await buildRecurringSummary({
      activeAsOf: now,
      assignedSince: todayStart,
      assignedUntil: todayEnd,
      completedSince: yesterdayStart,
      completedUntil: yesterdayEnd,
      yesterdayAssignedSince: yesterdayStart,
      yesterdayAssignedUntil: yesterdayEnd,
      includeAllTaskTypes: true,
      maxCards: 20,
    });

    let emailsSent = 0;
    for (const [, { user, stats, taskCards, taskCardsTruncated, overdueCards, todayCards, pendingCards, inProgressCards, completedCards, todayAssignedCards, highPriorityCards, upcomingCards }] of perUser) {
      if (!user || !user.email) continue;
      
      // SKIP: Super Admin should not receive Daily User Summary per new email policy
      if (user.role === "Super Admin") continue;

      await sendRecurringSummaryEmail({
        userEmail: user.email,
        userName: user.name,
        type: "daily",
        stats,
        taskCards,
        taskCardsTruncated: taskCardsTruncated || false,
        totalTasks: stats.totalActive,
        overdueCards,
        todayCards,
        pendingCards,
        inProgressCards,
        completedCards,
        todayAssignedCards,
        highPriorityCards,
        upcomingCards,
      });
      emailsSent++;
    }

    console.log(`[CronJobs] Sent ${emailsSent} daily recurring summary emails`);
  } catch (error) {
    console.error("[CronJobs] sendDailyRecurringSummary failed:", error.message);
  } finally {
    await completeSummaryPeriodLock("daily", istDateKey);
  }
};

/**
 * SendWeeklyRecurringSummary — runs Monday at 09:00 AM IST.
 *
 * Sends one email per user with:
 *   • Section 1 "Last Week Performance" (Mon→Sat of previous week)
 *   • Section 2 "This Week's Work" (Mon→Sat of current week)
 * followed by task cards (max 20, with "+X more" link if truncated).
 *
 * Reporting windows (Sunday is excluded):
 *   lastWeekStart = previous Monday 00:00:00 IST
 *   lastWeekEnd   = previous Saturday 23:59:59.999 IST
 *   thisWeekStart = current Monday 00:00:00 IST
 *   thisWeekEnd   = current Saturday 23:59:59.999 IST
 */
const sendWeeklyRecurringSummary = async () => {
  const now = new Date();
  const { hour } = getKolkataDateParts(now);
  if (hour !== 9 || getKolkataDayOfWeek(now) !== 1) {
    return;
  }
  const istDateKey = formatISTDateKey(startOfWeekIST(now));

  const lockAcquired = await acquireSummaryPeriodLock("weekly", istDateKey);
  if (!lockAcquired) return;

  try {
    await ensureMongoConnection();

    // Monday 00:00:00 IST of the current week (Sunday-excluded window start)
    const thisWeekStart = startOfWeekIST(now);
    // Saturday 23:59:59.999 IST of the current week (Sunday-excluded window end)
    const thisWeekEnd = new Date(thisWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000 - 1);
    // Previous week windows (Monday→Saturday, Sunday excluded)
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(thisWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const perUser = await buildRecurringSummary({
      activeAsOf: now,
      assignedSince: thisWeekStart,
      assignedUntil: thisWeekEnd,
      completedSince: lastWeekStart,
      completedUntil: lastWeekEnd,
      lastWeekAssignedSince: lastWeekStart,
      lastWeekAssignedUntil: lastWeekEnd,
      dueSince: thisWeekStart,
      dueUntil: thisWeekEnd,
      includeAllTaskTypes: true,
      maxCards: 20,
    });

    let emailsSent = 0;
    for (const [, { user, stats, taskCards, taskCardsTruncated, overdueCards, todayCards, pendingCards, inProgressCards, completedCards, todayAssignedCards, highPriorityCards, upcomingCards, dueThisWeekCards }] of perUser) {
      if (!user || !user.email) continue;
      
      // SKIP: Super Admin should not receive Weekly User Summary per new email policy
      if (user.role === "Super Admin") continue;

      await sendRecurringSummaryEmail({
        userEmail: user.email,
        userName: user.name,
        type: "weekly",
        stats,
        taskCards,
        taskCardsTruncated: taskCardsTruncated || false,
        totalTasks: stats.totalActive,
        overdueCards,
        todayCards,
        pendingCards,
        inProgressCards,
        completedCards,
        todayAssignedCards,
        highPriorityCards,
        upcomingCards,
        dueThisWeekCards,
      });
      emailsSent++;
    }

    console.log(`[CronJobs] Sent ${emailsSent} weekly recurring summary emails`);
  } catch (error) {
    console.error("[CronJobs] sendWeeklyRecurringSummary failed:", error.message);
  } finally {
    await completeSummaryPeriodLock("weekly", istDateKey);
  }
};

/**
 * SendDailyManagementSummary — runs daily at 6:00 PM IST.
 *
 * Sends a single company-wide management summary to every active Super
 * Admin. Company-wide stats are aggregated by buildRecurringSummary in
 * company mode (all task types), reusing the same builder/email/SMTP.
 * The lock namespace is windowed per IST date so each day runs once.
 */
const sendDailyManagementSummary = async () => {
  const now = new Date();
  const { hour } = getKolkataDateParts(now);
  if (hour !== 18) {
    return;
  }
  const istDateKey = formatISTDateKey(now);

  const lockAcquired = await acquireSummaryPeriodLock("management", istDateKey);
  if (!lockAcquired) return;

  try {
    await ensureMongoConnection();

    const todayStart = startOfDayIST(now);
    const todayEnd = endOfDayIST(now);

    const companyMap = await buildRecurringSummary({
      companyMode: true,
      perEmployee: true,
      activeAsOf: now,
      assignedSince: todayStart,
      assignedUntil: todayEnd,
      completedSince: todayStart,
      completedUntil: todayEnd,
      maxCards: 20,
    });

    const companyEntry = companyMap.get("company");
    if (!companyEntry) return;

    const superAdmins = await User.find({ role: "Super Admin", isActive: true })
      .select("_id name email")
      .lean();

    let emailsSent = 0;
    for (const admin of superAdmins) {
      if (!admin || !admin.email) continue;

      await sendRecurringSummaryEmail({
        userEmail: admin.email,
        userName: admin.name,
        type: "management",
        stats: companyEntry.stats,
        taskCards: companyEntry.taskCards,
        taskCardsTruncated: companyEntry.taskCardsTruncated,
        totalTasks: companyEntry.stats.totalActive,
        overdueCards: companyEntry.overdueCards,
        todayCards: companyEntry.todayCards,
        pendingCards: companyEntry.pendingCards,
        completedCards: companyEntry.completedCards,
        todayAssignedCards: companyEntry.todayAssignedCards,
        highPriorityCards: companyEntry.highPriorityCards,
        upcomingCards: companyEntry.upcomingCards,
        dueThisWeekCards: companyEntry.dueThisWeekCards,
        dueTomorrowCards: companyEntry.dueTomorrowCards,
        topDepartments: companyEntry.topDepartments,
        employees: companyEntry.employees,
      });
      emailsSent++;
    }

    console.log(`[CronJobs] Sent ${emailsSent} daily management summary emails`);
  } catch (error) {
    console.error("[CronJobs] sendDailyManagementSummary failed:", error.message);
  } finally {
    await completeSummaryPeriodLock("management", istDateKey);
  }
};

const initCronJobs = async () => {
  if (globalThis.__cronJobsInitDone) {
    return;
  }

  if (globalThis.__cronJobsInitPromise) {
    return globalThis.__cronJobsInitPromise;
  }

  globalThis.__cronJobsInitPromise = (async () => {
    const { default: cron } = await import("node-cron");

    // Generate recurring tasks at 12:00 AM IST (changed from 2:00 AM)
    cron.schedule(
      "0 0 * * *",
      async () => {
        await generateRecurringTasks();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Send assignment emails for newly generated tasks at 9:00 AM IST
    cron.schedule(
      "0 9 * * *",
      async () => {
        await sendAssignmentEmailsForNewTasks();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Send milestone-based deadline alerts daily at 9:00 AM IST
    cron.schedule(
      "0 9 * * *",
      async () => {
        await sendDeadlineAlerts();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Process scheduled reminder emails every minute so custom intervals are respected
    cron.schedule(
      "* * * * *",
      async () => {
        await processScheduledEmails();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Process overdue tasks and send summary emails at 12:00 PM IST
    cron.schedule(
      "0 12 * * *",
      async () => {
        await processOverdueTasks();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Send daily recurring task summary at 9:00 AM IST
    // Replaces individual reminder/overdue/milestone emails for the 6 recurring types
    cron.schedule(
      "0 9 * * *",
      async () => {
        await sendDailyRecurringSummary();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Send weekly recurring task summary on Monday at 9:00 AM IST
    // Reports the previous week (Monday to Saturday); Sunday excluded
    cron.schedule(
      "0 9 * * 1",
      async () => {
        await sendWeeklyRecurringSummary();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Send company-wide daily management summary to Super Admins at 6:00 PM IST
    // Aggregates ALL task types company-wide (daily/weekly are per-user)
    cron.schedule(
      "0 18 * * *",
      async () => {
        await sendDailyManagementSummary();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Mark cron as initialized immediately (all schedulers registered)
    // This prevents duplicate registrations in Next.js Fast Refresh / Hot Reload
    globalThis.__cronJobsInitDone = true;
    if (!globalThis.__cronSchedulerLogged) {
      globalThis.__cronSchedulerLogged = true;
      console.log("[CronJobs] Reminder scheduler initialized");
    }

    // Ensure MongoDB is connected before running one-time startup operations.
    // mongoose.connect() with bufferCommands: false sets the flag synchronously
    // BEFORE the connection finishes, which can cause a microtask-level race
    // where the first query hits bufferCommands: false before the collection's
    // internal pipeline is fully initialized. The open event double-check
    // guarantees the connection is truly settled.
    await ensureMongoConnection();
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once("open", resolve));
    }

    // Recalculate nextGenerationDate for all active templates using the new
    // IST calendar schedule. This runs once on startup to fix any templates
    // that still carry dates from the old relative-time calculation.
    await recalculateAllTemplateDates();
  })().catch((error) => {
    console.error("[CronJobs] Startup operation failed:", error.message);
  });

  return globalThis.__cronJobsInitPromise;
};

export {
  initCronJobs,
  generateRecurringTasks,
  generateNextTaskOccurrence,
  sendDeadlineAlerts,
  processScheduledEmails,
  processOverdueTasks,
  sendAssignmentEmailsForNewTasks,
  sendDailyRecurringSummary,
  sendWeeklyRecurringSummary,
  sendDailyManagementSummary,
};
