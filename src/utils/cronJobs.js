import Task from "../models/Task.js";
import User from "../models/User.js";
import { sendTaskReminderEmail } from "./emailService.js";

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
      status: "Pending",
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
    // Silently fail task generation error
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
    // Silently fail recurring task generation error
  }
};

const sendPendingTaskReminders = async () => {
  try {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const pendingTasks = await Task.find({
      status: { $in: ["Pending", "In Progress"] },
      deadline: { $lte: twoDaysFromNow, $gt: new Date() },
    }).populate("assignedTo assignedBy");

    for (const task of pendingTasks) {
      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : [task.assignedTo];

      for (const assignee of assignees) {
        if (assignee && assignee.email) {
          try {
            await sendTaskReminderEmail(assignee.email, assignee.name, {
              title: task.title,
              description: task.description,
              deadline: task.deadline,
              priority: task.priority,
            });
          } catch (emailError) {
            // Silently fail email errors
          }
        }
      }
    }
  } catch (error) {
    // Silently fail reminder error
  }
};

const initCronJobs = async () => {
  const { default: cron } = await import("node-cron");

  cron.schedule("0 2 * * *", async () => {
    await generateRecurringTasks();
  });

  cron.schedule("0 9 * * *", async () => {
    await sendPendingTaskReminders();
  });
};

export {
  initCronJobs,
  generateRecurringTasks,
  generateNextTaskOccurrence,
  sendPendingTaskReminders,
};
