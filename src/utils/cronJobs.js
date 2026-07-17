import mongoose from "mongoose";
import Task from "../models/Task.js";
import User from "../models/User.js";
import {
  sendTaskReminderEmail,
  sendTaskAssignmentEmail,
  sendTaskDueTodayEmail,
  sendOverdueTasksSummaryEmail,
  sendTaskOverdueAlertEmail,
} from "./emailService.js";
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
import { generateCompleteToken } from "./completeToken.js";
import { generateCommentToken } from "./commentToken.js";
import { generateExtensionToken } from "./extensionToken.js";

const generateNextTaskOccurrence = async (parentTask) => {
  try {
    const {
      recurrencePattern,
      recurrenceEndDate,
      deadline,
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

    const currentDeadline = new Date(deadline);
    let nextDeadline = new Date(currentDeadline);

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

const generateRecurringTasks = async () => {
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
    console.error("[CronJobs] generateRecurringTasks failed:", error.message);
  }
};

const sendDeadlineAlerts = async () => {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeTasks = await Task.find({
      status: { $nin: ["Completed", "Cancelled", "Overdue"] },
      deadline: { $exists: true, $ne: null },
    }).populate("assignedTo assignedBy");

    let alertsSent = 0;

    for (const task of activeTasks) {
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

              if (milestoneKey === "dueToday") {
                await sendTaskDueTodayEmail(assignee.email, assignee.name, baseDetails);
              } else {
                await sendTaskReminderEmail(assignee.email, assignee.name, baseDetails);
              }
              alertsSent++;
            } catch (emailError) {
              console.error(
                "[CronJobs] Failed to send deadline alert:",
                emailError.message,
              );
            }

            reminderState.milestoneFlags = markDeadlineMilestoneSent(
              reminderState,
              milestoneKey,
            ).milestoneFlags;
            reminderState.lastReminderType = "normal";
            reminderState.lastEmailTemplate =
              milestoneKey === "dueToday" ? "dueToday" : "reminder";
          }
        }
      }

      if (task.reminderState && task.reminderState.length > 0) {
        await task.save();
      }
    }

    console.log(`[CronJobs] Sent ${alertsSent} deadline alerts`);
  } catch (error) {
    console.error("[CronJobs] sendDeadlineAlerts failed:", error.message);
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
    }).populate("assignedTo assignedBy");

    let processedCount = 0;

    for (const task of tasksNeedingEmails) {
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

          if (mode === "overdue") {
            await sendTaskOverdueAlertEmail(assignee.email, assignee.name, {
              ...baseDetails,
              daysOverdue: Math.ceil(
                (now.getTime() - new Date(task.deadline).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            });
          } else {
            await sendTaskReminderEmail(assignee.email, assignee.name, baseDetails);
          }

          const updatedState = updateReminderStateAfterSend(
            task,
            reminderState,
            now,
            mode,
          );
          const index = task.reminderState.findIndex(
            (entry) => entry.user?.toString() === assignee._id.toString(),
          );
          if (index >= 0) {
            task.reminderState[index] = updatedState;
          }
          processedCount++;
        } catch (emailError) {
          console.error(
            "[CronJobs] Failed to send scheduled reminder:",
            emailError.message,
          );
        }
      }

      if (task.reminderState && task.reminderState.length > 0) {
        await task.save();
      }
    }

    console.log(`[CronJobs] Processed ${processedCount} reminder emails`);
  } catch (error) {
    console.error("[CronJobs] processScheduledEmails failed:", error.message);
  } finally {
    await releaseReminderLock();
  }
};

const processOverdueTasks = async () => {
  try {
    const now = new Date();

    // Find tasks that are overdue (deadline passed) but not yet marked as Overdue
    const tasksToMarkOverdue = await Task.find({
      status: { $nin: ["Completed", "Cancelled", "Overdue"] },
      deadline: { $lt: now },
    }).populate("assignedTo");

    // Update task statuses to Overdue
    const taskIds = tasksToMarkOverdue.map((task) => task._id);
    if (taskIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: taskIds } },
        { status: "Overdue", isOverdue: true },
      );
      console.log(`[CronJobs] Marked ${taskIds.length} tasks as Overdue`);
    }

    // Group overdue tasks by user for summary emails
    const userOverdueMap = new Map();

    for (const task of tasksToMarkOverdue) {
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

    // Send one summary email per user
    let emailsSent = 0;
    for (const [userId, { user, count }] of userOverdueMap) {
      if (user && user.email && count > 0) {
        try {
          await sendOverdueTasksSummaryEmail(user.email, user.name, count);
          emailsSent++;
        } catch (emailError) {
          console.error(
            "[CronJobs] Failed to send overdue summary email:",
            emailError.message,
          );
        }
      }
    }

    console.log(`[CronJobs] Sent ${emailsSent} overdue summary emails`);
  } catch (error) {
    console.error("[CronJobs] processOverdueTasks failed:", error.message);
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

    cron.schedule(
      "0 2 * * *",
      async () => {
        await generateRecurringTasks();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    // Send milestone-based deadline alerts daily at 9 AM
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

    // Process overdue tasks and send summary emails at 12:00 PM
    cron.schedule(
      "0 12 * * *",
      async () => {
        await processOverdueTasks();
      },
      {
        timezone: "Asia/Kolkata",
      },
    );

    globalThis.__cronJobsInitDone = true;
    if (!globalThis.__cronSchedulerLogged) {
      globalThis.__cronSchedulerLogged = true;
      console.log("[CronJobs] Reminder scheduler initialized");
    }
  })().catch((error) => {
    globalThis.__cronJobsInitPromise = null;
    throw error;
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
};
