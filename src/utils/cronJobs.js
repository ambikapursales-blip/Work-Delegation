import cron from "node-cron";
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
      console.log(`Recurrence ended for task: ${title}`);
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

    console.log(`Generated new task occurrence: ${savedTask._id} for ${title}`);
    return savedTask;
  } catch (error) {
    console.error("Error generating task occurrence:", error);
  }
};

const generateRecurringTasks = async () => {
  try {
    console.log("Checking for recurring tasks to generate...");

    const recurringTasks = await Task.find({
      isRecurring: true,
      taskType: { $ne: "One-time" },
      $or: [
        { recurrenceEndDate: { $gt: new Date() } },
        { recurrenceEndDate: { $exists: false } },
      ],
    }).populate("assignedTo assignedBy");

    console.log(`Found ${recurringTasks.length} recurring tasks`);

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

    console.log("Checking for completed child tasks...");
    const completedChildTasks = await Task.find({
      parentTaskId: { $exists: true, $ne: null },
      status: "Completed",
    }).populate("parentTaskId");

    console.log(`Found ${completedChildTasks.length} completed child tasks`);

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
          console.log(
            `Child task completed, generating next instance for parent: ${parentTask.title}`,
          );
          await generateNextTaskOccurrence(parentTask);
        }
      }
    }

    console.log("Recurring task generation completed");
  } catch (error) {
    console.error("Error in recurring task generation:", error);
  }
};

const sendPendingTaskReminders = async () => {
  try {
    console.log("Checking for pending tasks approaching deadline...");

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const pendingTasks = await Task.find({
      status: { $in: ["Pending", "In Progress"] },
      deadline: { $lte: twoDaysFromNow, $gt: new Date() },
    }).populate("assignedTo assignedBy");

    console.log(
      `Found ${pendingTasks.length} pending tasks approaching deadline`,
    );

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
            console.log(
              `Reminder email sent to ${assignee.email} for task: ${task.title}`,
            );
          } catch (emailError) {
            console.error(
              `Failed to send reminder email to ${assignee.email}:`,
              emailError,
            );
          }
        }
      }
    }

    console.log("Pending task reminder emails completed");
  } catch (error) {
    console.error("Error in pending task reminders:", error);
  }
};

const initCronJobs = () => {
  console.log("Cron Jobs initialized");

  cron.schedule("0 2 * * *", async () => {
    console.log("Running recurring task generation...");
    await generateRecurringTasks();
  });

  cron.schedule("0 9 * * *", async () => {
    console.log("Running pending task reminders...");
    await sendPendingTaskReminders();
  });
};

export {
  initCronJobs,
  generateRecurringTasks,
  generateNextTaskOccurrence,
  sendPendingTaskReminders,
};
