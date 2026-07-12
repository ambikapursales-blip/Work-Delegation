import Task from "../models/Task.js";
import User from "../models/User.js";
import { sendTaskReminderEmail, sendTaskAssignmentEmail, sendTaskDueTodayEmail, sendOverdueTasksSummaryEmail } from "./emailService.js";
import { shouldSendEmailToday, updateEmailSchedule } from "./emailFrequencyEngine.js";

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
    console.error("[CronJobs] generateNextTaskOccurrence failed:", error.message);
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
    
    // Find all active (non-completed, non-overdue) tasks with deadlines
    const activeTasks = await Task.find({
      status: { $nin: ["Completed", "Cancelled", "Overdue"] },
      deadline: { $exists: true, $ne: null },
    }).populate("assignedTo assignedBy");

    let alertsSent = 0;

    for (const task of activeTasks) {
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      
      const diffTime = deadlineDate - now;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Skip if overdue
      if (daysRemaining < 0) continue;

      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];

      // Define milestones in order
      const milestones = [
        { days: 4, field: 'fourDays', label: '4 Days Left' },
        { days: 3, field: 'threeDays', label: '3 Days Left' },
        { days: 2, field: 'twoDays', label: '2 Days Left' },
        { days: 1, field: 'oneDay', label: '1 Day Left' },
        { days: 0, field: 'dueToday', label: 'Due Today' },
      ];

      // Find the current milestone based on daysRemaining
      // Only send if we're exactly on that milestone day and it hasn't been sent
      // Never send outdated milestones (past days)
      for (const milestone of milestones) {
        if (daysRemaining === milestone.days && !task.deadlineAlerts[milestone.field]) {
          for (const assignee of assignees) {
            if (assignee && assignee.email) {
              try {
                if (milestone.days === 0) {
                  await sendTaskDueTodayEmail(assignee.email, assignee.name, {
                    title: task.title,
                    description: task.description,
                    assignedBy: task.assignedBy?.name || "Unknown",
                    priority: task.priority,
                  });
                } else {
                  await sendTaskReminderEmail(assignee.email, assignee.name, {
                    title: task.title,
                    description: task.description,
                    deadline: task.deadline,
                    priority: task.priority,
                  });
                }
                alertsSent++;
              } catch (emailError) {
                console.error("[CronJobs] Failed to send deadline alert:", emailError.message);
              }
            }
          }
          // Mark this milestone as sent
          task.deadlineAlerts[milestone.field] = true;
          await task.save();
          break; // Only send one alert per task per day
        }
      }
    }

    console.log(`[CronJobs] Sent ${alertsSent} deadline alerts`);
  } catch (error) {
    console.error("[CronJobs] sendDeadlineAlerts failed:", error.message);
  }
};

const processScheduledEmails = async () => {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Find tasks that need emails sent today based on their email schedule
    const tasksNeedingEmails = await Task.find({
      status: { $ne: "Completed" },
      "emailSchedule.nextEmailDate": { $lte: now },
    }).populate("assignedTo assignedBy");

    for (const task of tasksNeedingEmails) {
      if (!task.emailSchedule || !task.emailSchedule.isRecurring) {
        continue;
      }

      // Check if any deadline alert milestone is scheduled for today
      // If so, skip frequency reminder to prevent duplicate emails
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      const diffTime = deadlineDate - now;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const milestoneDays = [4, 3, 2, 1, 0];
      if (milestoneDays.includes(daysRemaining)) {
        console.log(`[CronJobs] Skipping frequency reminder for task "${task.title}" - deadline alert scheduled for today (${daysRemaining} days remaining)`);
        continue;
      }

      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];

      for (const assignee of assignees) {
        if (assignee && assignee.email) {
          try {
            await sendTaskAssignmentEmail(assignee.email, assignee.name, {
              title: task.title,
              description: task.description,
              priority: task.priority,
              deadline: task.deadline,
            });
          } catch (emailError) {
            console.error("[CronJobs] Failed to send scheduled email:", emailError.message);
          }
        }
      }

      // Update the email schedule for this task
      task.emailSchedule = updateEmailSchedule(task.emailSchedule);
      await task.save();
    }

    console.log(`[CronJobs] Processed ${tasksNeedingEmails.length} scheduled emails`);
  } catch (error) {
    console.error("[CronJobs] processScheduledEmails failed:", error.message);
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
    const taskIds = tasksToMarkOverdue.map(task => task._id);
    if (taskIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: taskIds } },
        { status: "Overdue", isOverdue: true }
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
          console.error("[CronJobs] Failed to send overdue summary email:", emailError.message);
        }
      }
    }

    console.log(`[CronJobs] Sent ${emailsSent} overdue summary emails`);
  } catch (error) {
    console.error("[CronJobs] processOverdueTasks failed:", error.message);
  }
};

const initCronJobs = async () => {
  const { default: cron } = await import("node-cron");

  cron.schedule("0 2 * * *", async () => {
    await generateRecurringTasks();
  }, {
    timezone: "Asia/Kolkata"
  });

  // Send milestone-based deadline alerts daily at 9 AM
  cron.schedule("0 9 * * *", async () => {
    await sendDeadlineAlerts();
  }, {
    timezone: "Asia/Kolkata"
  });

  // Process scheduled frequency-based emails daily at 10 AM
  cron.schedule("0 10 * * *", async () => {
    await processScheduledEmails();
  }, {
    timezone: "Asia/Kolkata"
  });

  // Process overdue tasks and send summary emails at 12:00 PM
  cron.schedule("0 12 * * *", async () => {
    await processOverdueTasks();
  }, {
    timezone: "Asia/Kolkata"
  });
};

export {
  initCronJobs,
  generateRecurringTasks,
  generateNextTaskOccurrence,
  sendDeadlineAlerts,
  processScheduledEmails,
  processOverdueTasks,
};
