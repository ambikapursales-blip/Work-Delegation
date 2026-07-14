import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { generateNextTaskOccurrence } from "../utils/cronJobs.js";
import {
  sendTaskAssignmentEmail,
  sendTaskAssignedConfirmationEmail,
  sendTaskCompletionEmail,
  sendTaskEscalationEmail,
  sendTaskStatusUpdateEmail,
} from "../utils/emailService.js";
import { createEmailSchedule } from "../utils/emailFrequencyEngine.js";
import { generateCompleteToken } from "../utils/completeToken.js";
import { generateCommentToken } from "../utils/commentToken.js";
import { generateExtensionToken } from "../utils/extensionToken.js";
import {
  normalizeTaskStatus,
  toArray,
  buildAssigneeProgress,
} from "../utils/taskHelpers.js";
import { buildActionUrl } from "../utils/conversationAuth.js";
import { getTaskScopeFilter } from "../lib/taskScope.js";
import {
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyTaskReopened,
  notifyStatusChanged,
  notifyDeadlineExtended,
  notifyPriorityChanged,
  notifyAttachmentUploaded,
  notifyCommentAdded,
  notifyAssigneeChanged,
} from "../utils/conversationMessages.js";

export const getTasks = async (req, res) => {
  try {
    const {
      status,
      priority,
      assignedTo,
      assignedBy,
      page = 1,
      limit = 15,
      search,
      overdue,
      startDate,
      endDate,
      period,
      userId,
    } = req.query;

    let query = {};

    const taskScope = await getTaskScopeFilter(req.user);
    Object.assign(query, taskScope);

    if (status) {
      query.status = normalizeTaskStatus(status);
    }
    if (priority) query.priority = priority;
    const canUseParamOverride = req.user.role === "Super Admin" || req.user.canViewAllTasks;
    if (canUseParamOverride) {
      const effectiveAssignedTo = assignedTo || userId;
      if (effectiveAssignedTo) query.assignedTo = effectiveAssignedTo;
    }
    if (assignedBy) query.assignedBy = assignedBy;
    if (overdue === "true") {
      query.deadline = { $lt: new Date() };
      query.status = { $nin: ["Completed", "Cancelled"] };
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    } else if (period) {
      const now = new Date();
      let start = new Date();
      switch (period) {
        case "week":
          start.setDate(now.getDate() - 7);
          break;
        case "month":
          start.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          start.setMonth(now.getMonth() - 3);
          break;
        case "year":
          start.setFullYear(now.getFullYear() - 1);
          break;
      }
      query.createdAt = { $gte: start };
    }

    if (search) {
      query.$or = query.$or || [];
      query.$or.push(
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      );
    }

    const skip = (page - 1) * limit;
    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query).lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
        { path: "history.changedBy", select: "name" },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.status(200).json({
      success: true,
      count: tasks.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      tasks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean().populate([
      { path: "assignedTo", select: "name email role avatar" },
      { path: "assignedBy", select: "name email role" },
      { path: "history.changedBy", select: "name email" },
    ]);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const canViewAll = req.user.canViewAllTasks;
    const isAssigned = Array.isArray(task.assignedTo)
      ? task.assignedTo.some((a) => a._id.toString() === req.user._id.toString())
      : task.assignedTo?._id?.toString() === req.user._id.toString();
    const isAssigner =
      task.assignedBy?._id?.toString() === req.user._id.toString() ||
      task.assignedBy?.toString() === req.user._id.toString();

    let isManagerOfAssignee = false;
    if (req.user.role === "Manager") {
      const assigneeIds = Array.isArray(task.assignedTo)
        ? task.assignedTo.map((a) => a._id?.toString() || a.toString())
        : [task.assignedTo?._id?.toString() || task.assignedTo?.toString()];
      const teamMembers = await User.find({ managerId: req.user._id })
        .select("_id")
        .lean();
      const teamIds = new Set(teamMembers.map((m) => m._id.toString()));
      isManagerOfAssignee = assigneeIds.some((id) => teamIds.has(id));
    }

    if (!isSuperAdmin && !canViewAll && !isAssigned && !isAssigner && !isManagerOfAssignee) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view this task" });
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      deadline,
      assignedTo,
      department,
      tags,
      estimatedHours,
      taskType = "One Time",
      category,
      isRecurring = false,
      recurrencePattern = null,
      recurrenceEndDate = null,
    } = req.body;

    const assignees = toArray(assignedTo);

    // Single query: validate assignees exist and get their data
    const assigneeUsers = await User.find({ _id: { $in: assignees } }).lean().select("_id name email");
    const validIds = new Set(assigneeUsers.map((u) => u._id.toString()));
    const invalidIds = assignees.filter((id) => !validIds.has(id.toString()));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following assigned user(s) do not exist: ${invalidIds.join(", ")}`,
      });
    }

    if (isRecurring && !recurrencePattern) {
      return res.status(400).json({
        success: false,
        message: "Recurrence pattern is required for recurring tasks",
      });
    }

    const assigneeProgress = buildAssigneeProgress(assignees);

    const taskData = {
      title,
      description,
      priority,
      deadline,
      assignedTo: assignees,
      assignedBy: req.user._id,
      department,
      tags,
      estimatedHours,
      assigneeProgress,
      taskType,
      category,
      isRecurring,
      emailSchedule: createEmailSchedule(taskType, new Date()),
      history: [
        { status: "In Progress", changedBy: req.user._id, note: "Task created" },
      ],
    };

    if (isRecurring) {
      taskData.recurrencePattern = recurrencePattern;
      if (recurrenceEndDate) {
        taskData.recurrenceEndDate = new Date(recurrenceEndDate);
      }
      const nextDate = new Date(deadline);
      if (recurrencePattern.frequency === "daily") {
        nextDate.setDate(
          nextDate.getDate() + (recurrencePattern.interval || 1),
        );
      } else if (recurrencePattern.frequency === "weekly") {
        nextDate.setDate(
          nextDate.getDate() + 7 * (recurrencePattern.interval || 1),
        );
      } else if (recurrencePattern.frequency === "biweekly") {
        nextDate.setDate(nextDate.getDate() + 14);
      } else if (recurrencePattern.frequency === "monthly") {
        nextDate.setMonth(
          nextDate.getMonth() + (recurrencePattern.interval || 1),
        );
      }
      taskData.nextOccurrenceDate = nextDate;
      taskData.lastGeneratedDate = new Date();
    }

    const task = await Task.create(taskData);

    const recurringText = isRecurring ? ` (${taskType})` : "";

    let assignMessage = null;
    try {
      assignMessage = await notifyTaskAssigned(task._id, req.user._id, assigneeUsers.map((u) => u.name).join(", "));
    } catch (e) {
      console.error("Failed to create system message:", e);
    }

    let assignConversation = null;
    if (assignMessage) {
      try {
        const Conversation = (await import("../models/Conversation.js")).default;
        assignConversation = await Conversation.findOne({ taskId: task._id }).select("_id").lean();
      } catch (e) {
        console.error("Failed to find conversation:", e);
      }
    }

    // Batch create notifications
    const notifications = assigneeUsers.map((assignee) => ({
      recipient: assignee._id,
      sender: req.user._id,
      title: "New Task Assigned",
      message: `You have been assigned a new task: "${title}"${recurringText}`,
      type: "task_assigned",
      entityId: task._id,
      entityType: "Task",
      actionUrl: buildActionUrl(task._id, assignMessage?._id),
      conversationId: assignConversation?._id,
      messageId: assignMessage?._id,
    }));
    await Notification.insertMany(notifications);

    // Background email sending — fire and forget, never blocks the response
    const emailPromises = [];
    for (const assignee of assigneeUsers) {
      if (assignee.email) {
        emailPromises.push(
          sendTaskAssignmentEmail(assignee.email, assignee.name, {
            title,
            description,
            priority,
            deadline,
            taskId: String(task._id),
            userId: String(assignee._id),
            completeToken: generateCompleteToken(String(task._id), String(assignee._id)),
            commentToken: generateCommentToken(String(task._id), String(assignee._id)),
            extensionToken: generateExtensionToken(String(task._id), String(assignee._id)),
            assignedBy: { name: req.user.name, email: req.user.email },
          }).catch((e) => console.error("Failed to send assignment email:", e)),
        );
      }
    }
    if (assigneeUsers.length > 0 && req.user.email) {
      emailPromises.push(
        sendTaskAssignedConfirmationEmail(
          req.user.email,
          req.user.name,
          { title, description, priority, deadline, taskId: task._id },
          assigneeUsers.map((u) => u.name).join(", "),
        ).catch((e) => console.error("Failed to send confirmation email:", e)),
      );
    }
    Promise.allSettled(emailPromises);

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} created ${isRecurring ? "recurring " : ""}task "${title}" and assigned to ${assigneeUsers.map((u) => u.name).join(", ")}`,
      entityId: task._id,
      entityType: "Task",
    });

    // Populate the created task directly — avoids a separate findById query
    await task.populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    const isAssignee = Array.isArray(task.assignedTo)
      ? task.assignedTo.some((id) => id.toString() === req.user._id.toString())
      : task.assignedTo.toString() === req.user._id.toString();
    const isAssigner = task.assignedBy.toString() === req.user._id.toString();
    const isAdmin = ["Super Admin", "Admin", "HR"].includes(req.user.role);

    if (!isAssignee && !isAssigner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this task",
      });
    }

    const {
      title,
      description,
      priority,
      deadline,
      status,
      remarks,
      actualHours,
      assignedTo,
      completionProof,
      taskType,
      category,
    } = req.body;

    if (status) {
      req.body.status = normalizeTaskStatus(status);
    }

    if (req.body.status === "Completed") {
      if (!req.body.completionProof || req.body.completionProof.trim() === "") {
        return res.status(400).json({
          success: false,
          message:
            "Completion proof is required when marking a task as completed",
        });
      }
    }

    if (assignedTo) {
      const assigneeIds = toArray(assignedTo);
      const existingUsers = await User.find({ _id: { $in: assigneeIds } }).lean().select("_id");
      const validIds = new Set(existingUsers.map((u) => u._id.toString()));
      const invalidIds = assigneeIds.filter((id) => !validIds.has(id.toString()));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `The following assigned user(s) do not exist: ${invalidIds.join(", ")}`,
        });
      }
    }

    if (status && status !== task.status) {
      req.body.history = [
        ...task.history,
        {
          status: req.body.status,
          changedBy: req.user._id,
          changedAt: new Date(),
          note:
            req.body.statusNote ||
            req.body.completionProof ||
            `Status changed to ${req.body.status}`,
        },
      ];

      if (task.assigneeProgress && Array.isArray(task.assigneeProgress)) {
        const assigneeProgressEntry = task.assigneeProgress.find(
          (ap) => ap.user && ap.user.toString() === req.user._id.toString(),
        );
        if (assigneeProgressEntry) {
          assigneeProgressEntry.status = req.body.status;
          if (req.body.status === "Completed") {
            assigneeProgressEntry.completedAt = new Date();
            assigneeProgressEntry.actualHours = req.body.actualHours || 0;
          }
          req.body.assigneeProgress = task.assigneeProgress;
        }
      }

      const assigneeIds = Array.isArray(task.assignedTo)
        ? task.assignedTo.map((id) => (typeof id === "object" ? id.toString() : id))
        : [task.assignedTo.toString()];

      if (req.body.status === "Completed") {
        let completeMessage = null;
        try {
          completeMessage = await notifyTaskCompleted(task._id, req.user._id, req.user.name);
        } catch (e) {
          console.error("Failed to create system message:", e);
        }

        let completeConversation = null;
        if (completeMessage) {
          try {
            const Conversation = (await import("../models/Conversation.js")).default;
            completeConversation = await Conversation.findOne({ taskId: task._id }).select("_id").lean();
          } catch (e) {
            console.error("Failed to find conversation:", e);
          }
        }

        await Notification.create({
          recipient: task.assignedBy,
          sender: req.user._id,
          title: "Task Completed",
          message: `Task "${task.title}" has been marked as completed`,
          type: "task_completed",
          entityId: task._id,
          entityType: "Task",
          actionUrl: buildActionUrl(task._id, completeMessage?._id),
          conversationId: completeConversation?._id,
          messageId: completeMessage?._id,
        });

        try {
          const assigner = await User.findById(task.assignedBy);
          if (assigner && assigner.email) {
            await sendTaskCompletionEmail(
              assigner.email,
              {
                title: task.title,
                description: task.description,
                priority: task.priority,
              },
              req.user.name,
            );
          }
        } catch (emailError) {
          console.error("Failed to send completion email:", emailError);
        }

        if (task.parentTaskId) {
          try {
            const parentTask = await Task.findById(task.parentTaskId).lean().select("_id isRecurring taskType title assignedTo assignedBy").populate(
              "assignedTo assignedBy",
            );
            if (
              parentTask &&
              parentTask.isRecurring &&
              parentTask.taskType !== "One-time"
            ) {
              await generateNextTaskOccurrence(parentTask);
            }
          } catch (err) {
            console.error("Error generating next task occurrence:", err);
          }
        }
      }

      const assigneeUsers = await User.find({ _id: { $in: assigneeIds } }).lean().select("_id name email");
      for (const assignee of assigneeUsers) {
        if (assignee.email && assignee._id.toString() !== req.user._id.toString()) {
          try {
            await sendTaskStatusUpdateEmail(
              assignee.email,
              assignee.name,
              { title: task.title, description: task.description, priority: task.priority, deadline: task.deadline, taskId: task._id },
              req.body.status,
              req.user.name,
            );
          } catch (emailError) {
            console.error("Failed to send status update email to assignee:", emailError);
          }
        }
      }
      if (task.assignedBy.toString() !== req.user._id.toString() && req.body.status !== "Completed") {
        const assignerNotify = await User.findById(task.assignedBy).lean().select("name email");
        if (assignerNotify && assignerNotify.email) {
          try {
            await sendTaskStatusUpdateEmail(
              assignerNotify.email,
              assignerNotify.name,
              { title: task.title, description: task.description, priority: task.priority, deadline: task.deadline, taskId: task._id },
              req.body.status,
              req.user.name,
            );
          } catch (emailError) {
            console.error("Failed to send status update email to assigner:", emailError);
          }
        }
      }

      if (req.body.status !== "Completed" && req.body.status && req.body.status !== task.status) {
        try {
          await notifyStatusChanged(task._id, req.user._id, req.user.name, task.status, req.body.status);
        } catch (e) {
          console.error("Failed to create status change system message:", e);
        }
      }
    }

    if (status && status !== task.status && task.status === "Completed") {
      try {
        await notifyTaskReopened(task._id, req.user._id, req.user.name);
      } catch (e) {
        console.error("Failed to create reopened system message:", e);
      }
    }

    if (req.body.priority && req.body.priority !== task.priority) {
      try {
        await notifyPriorityChanged(task._id, req.user._id, req.user.name, task.priority, req.body.priority);
      } catch (e) {
        console.error("Failed to create priority change system message:", e);
      }
    }

    if (req.body.deadline && task.deadline && new Date(req.body.deadline).getTime() !== new Date(task.deadline).getTime()) {
      try {
        await notifyDeadlineExtended(task._id, req.user._id, req.user.name, task.deadline, req.body.deadline);
      } catch (e) {
        console.error("Failed to create deadline change system message:", e);
      }
    }

    if (req.body.attachments && req.body.attachments.length > 0) {
      const existingUrls = new Set((task.attachments || []).map((a) => a.url));
      for (const att of req.body.attachments) {
        if (att.url && existingUrls.has(att.url)) continue;
        try {
          await notifyAttachmentUploaded(task._id, req.user._id, req.user.name, att.name || "file");
        } catch (e) {
          console.error("Failed to create attachment upload system message:", e);
        }
      }
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await Activity.create({
      user: req.user._id,
      type: req.body.status === "Completed" ? "task_completed" : "task_updated",
      description: `${req.user.name} updated task "${task.title}"${req.body.status ? ` to ${req.body.status}` : ""}`,
      entityId: task._id,
      entityType: "Task",
    });

    res.status(200).json({ success: true, task: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    await task.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTaskStats = async (req, res) => {
  try {
    let matchQuery = {};

    const taskScope = await getTaskScopeFilter(req.user);
    Object.assign(matchQuery, taskScope);

    const stats = await Task.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const overdue = await Task.countDocuments({
      ...matchQuery,
      deadline: { $lt: new Date() },
      status: { $nin: ["Completed", "Cancelled"] },
    });

    const result = { overdue };
    stats.forEach((s) => {
      result[s._id.toLowerCase().replace(" ", "_")] = s.count;
    });

    res.status(200).json({ success: true, stats: result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const bulkCreateTasks = async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Tasks array is required" });
    }

    const allAssigneeIds = [...new Set(tasks.flatMap((t) => {
      const ids = toArray(t.assignedTo);
      return ids.map((id) => id?.toString());
    }).filter(Boolean))];

    const existingUsers = await User.find({ _id: { $in: allAssigneeIds } }).lean().select("_id");
    const validIds = new Set(existingUsers.map((u) => u._id.toString()));
    const invalidIds = allAssigneeIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following assigned user(s) do not exist: ${invalidIds.join(", ")}`,
      });
    }

    const createdTasks = [];
    const notifications = [];

    for (const taskData of tasks) {
      const assignees = toArray(taskData.assignedTo);
      const assigneeProgress = buildAssigneeProgress(assignees);

      const task = await Task.create({
        ...taskData,
        assignedTo: assignees,
        assignedBy: req.user._id,
        assigneeProgress,
        emailSchedule: createEmailSchedule(taskData.taskType, new Date()),
        history: [
          { status: "In Progress", changedBy: req.user._id, note: "Task created" },
        ],
      });

      createdTasks.push(task._id);

      assignees.forEach((assigneeId) => {
        notifications.push({
          recipient: assigneeId,
          sender: req.user._id,
          title: "New Task Assigned",
          message: `You have been assigned a new task: "${taskData.title}"`,
          type: "task_assigned",
          entityId: task._id,
          entityType: "Task",
          actionUrl: buildActionUrl(task._id),
        });
      });
    }

    await Notification.insertMany(notifications);

    const notifyUserIds = [...new Set(notifications.map((n) => n.recipient.toString()))];
    const allAssignees = await User.find({ _id: { $in: notifyUserIds } }).lean().select("_id name email");
    for (const assignee of allAssignees) {
      if (assignee.email) {
        try {
          await sendTaskAssignmentEmail(assignee.email, assignee.name, {
            title: tasks.length === 1 ? tasks[0].title : `${tasks.length} tasks assigned`,
            description: `You have been assigned ${tasks.length} task(s).`,
            priority: "Medium",
            deadline: null,
            taskId: tasks.length === 1 ? String(tasks[0]._id) : undefined,
            userId: String(assignee._id),
            completeToken: tasks.length === 1 ? generateCompleteToken(String(tasks[0]._id), String(assignee._id)) : undefined,
            commentToken: tasks.length === 1 ? generateCommentToken(String(tasks[0]._id), String(assignee._id)) : undefined,
            extensionToken: tasks.length === 1 ? generateExtensionToken(String(tasks[0]._id), String(assignee._id)) : undefined,
            assignedBy: { name: req.user.name, email: req.user.email },
          });
        } catch (emailError) {
          console.error("Failed to send bulk create email:", emailError);
        }
      }
    }
    if (req.user.email) {
      try {
        await sendTaskAssignedConfirmationEmail(
          req.user.email,
          req.user.name,
          { title: `${tasks.length} task(s) created`, description: `Bulk created and assigned to ${allAssignees.length} user(s).`, priority: "Medium", deadline: null, taskId: "" },
          allAssignees.map((u) => u.name).join(", "),
        );
      } catch (emailError) {
        console.error("Failed to send bulk create confirmation email:", emailError);
      }
    }

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} created ${tasks.length} tasks in bulk`,
      metadata: { taskIds: createdTasks },
    });

    const populatedTasks = await Task.find({
      _id: { $in: createdTasks },
    }).lean().populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(201).json({
      success: true,
      tasks: populatedTasks,
      count: createdTasks.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkAssignTasks = async (req, res) => {
  try {
    const { taskIds, userIds } = req.body;

    if (
      !taskIds ||
      !userIds ||
      !Array.isArray(taskIds) ||
      !Array.isArray(userIds)
    ) {
      return res.status(400).json({
        success: false,
        message: "taskIds and userIds arrays are required",
      });
    }

    const [tasks, users] = await Promise.all([
      Task.find({ _id: { $in: taskIds } }).lean().select("_id assignedTo assigneeProgress title"),
      User.find({ _id: { $in: userIds } }).lean().select("_id name email"),
    ]);

    const validUserIds = new Set(users.map((u) => u._id.toString()));
    const invalidUserIds = userIds.filter((id) => !validUserIds.has(id.toString()));
    if (invalidUserIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following user(s) do not exist: ${invalidUserIds.join(", ")}`,
      });
    }

    const notifications = [];
    const updates = [];

    for (const task of tasks) {
      const oldAssignees = [...task.assignedTo];
      const newAssignees = [...new Set([...task.assignedTo, ...userIds])];

      const newProgress = buildAssigneeProgress(
        userIds.filter(
          (id) =>
            !task.assigneeProgress.some(
              (p) => p.user.toString() === id.toString(),
            ),
        ),
      );

      const reassignmentEntries = userIds.map((userId) => ({
        to: userId,
        reassignedBy: req.user._id,
        reason: "Bulk assignment",
        reassignedAt: new Date(),
      }));

      updates.push({
        updateOne: {
          filter: { _id: task._id },
          update: {
            assignedTo: newAssignees,
            $push: {
              assigneeProgress: { $each: newProgress },
              reassignmentHistory: { $each: reassignmentEntries },
            },
          },
        },
      });

      userIds.forEach((userId) => {
        if (!oldAssignees.includes(userId)) {
          notifications.push({
            recipient: userId,
            sender: req.user._id,
            title: "Task Assigned",
            message: `You have been assigned to task: "${task.title}"`,
            type: "task_assigned",
            entityId: task._id,
            entityType: "Task",
            actionUrl: buildActionUrl(task._id),
          });
        }
      });
    }

    await Task.bulkWrite(updates);
    await Notification.insertMany(notifications);

    try {
      const addedUserNames = users.map((u) => u.name).filter(Boolean).join(", ");
      for (const task of tasks) {
        await notifyAssigneeChanged(task._id, req.user._id, req.user.name, "previous assignees", addedUserNames || userIds.join(", "));
      }
    } catch (e) {
      console.error("Failed to create bulk assign system messages:", e);
    }

    for (const user of users) {
      if (user.email) {
        try {
          await sendTaskAssignmentEmail(user.email, user.name, {
            title: tasks.length === 1 ? tasks[0].title : `${tasks.length} tasks`,
            description: `You have been assigned to ${tasks.length} task(s).`,
            priority: "Medium",
            deadline: null,
            taskId: tasks.length === 1 ? String(tasks[0]._id) : undefined,
            userId: String(user._id),
            completeToken: tasks.length === 1 ? generateCompleteToken(String(tasks[0]._id), String(user._id)) : undefined,
            commentToken: tasks.length === 1 ? generateCommentToken(String(tasks[0]._id), String(user._id)) : undefined,
            extensionToken: tasks.length === 1 ? generateExtensionToken(String(tasks[0]._id), String(user._id)) : undefined,
            assignedBy: { name: req.user.name, email: req.user.email },
          });
        } catch (emailError) {
          console.error("Failed to send bulk assignment email:", emailError);
        }
      }
    }
    if (req.user.email) {
      try {
        await sendTaskAssignedConfirmationEmail(
          req.user.email,
          req.user.name,
          { title: `${tasks.length} task(s)`, description: `Bulk assigned to ${users.length} user(s).`, priority: "Medium", deadline: null, taskId: "" },
          users.map((u) => u.name).join(", "),
        );
      } catch (emailError) {
        console.error("Failed to send bulk assignment confirmation email:", emailError);
      }
    }

    await Activity.create({
      user: req.user._id,
      type: "task_assigned",
      description: `${req.user.name} bulk assigned ${tasks.length} tasks to ${users.length} users`,
      metadata: { taskIds, userIds },
    });

    const updatedTasks = await Task.find({ _id: { $in: taskIds } }).lean().populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(200).json({ success: true, tasks: updatedTasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reassignTask = async (req, res) => {
  try {
    const { fromUserId, toUserId, reason } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId).lean().select("_id"),
      User.findById(toUserId).lean().select("_id name email"),
    ]);
    if (!fromUser) {
      return res.status(400).json({ success: false, message: `Source user does not exist: ${fromUserId}` });
    }
    if (!toUser) {
      return res.status(400).json({ success: false, message: `Target user does not exist: ${toUserId}` });
    }

    const oldAssignees = task.assignedTo.map((id) => id.toString());
    const newAssignees = oldAssignees
      .filter((id) => id !== fromUserId)
      .concat(toUserId);

    task.assigneeProgress = task.assigneeProgress.filter(
      (p) => p.user.toString() !== fromUserId,
    );
    task.assigneeProgress.push({
      user: toUserId,
      status: "Pending",
      actualHours: 0,
    });

    task.reassignmentHistory.push({
      from: fromUserId,
      to: toUserId,
      reassignedBy: req.user._id,
      reason,
      reassignedAt: new Date(),
    });

    task.assignedTo = newAssignees;
    await task.save();

    try {
      await notifyAssigneeChanged(task._id, req.user._id, req.user.name, fromUser?.name || fromUserId, toUser?.name || toUserId);
    } catch (e) {
      console.error("Failed to create assignee change system message:", e);
    }

    await Notification.create({
      recipient: toUserId,
      sender: req.user._id,
      title: "Task Reassigned",
      message: `Task "${task.title}" has been reassigned to you`,
      type: "task_assigned",
      entityId: task._id,
      entityType: "Task",
      actionUrl: buildActionUrl(task._id),
    });

    if (toUser.email) {
      try {
        await sendTaskAssignmentEmail(toUser.email, toUser.name, {
          title: task.title,
          description: task.description,
          priority: task.priority,
          deadline: task.deadline,
          taskId: String(task._id),
          userId: String(toUser._id),
          completeToken: generateCompleteToken(String(task._id), String(toUser._id)),
          commentToken: generateCommentToken(String(task._id), String(toUser._id)),
          extensionToken: generateExtensionToken(String(task._id), String(toUser._id)),
          assignedBy: { name: req.user.name, email: req.user.email },
          });
        } catch (emailError) {
        console.error("Failed to send reassignment email:", emailError);
      }
    }
    if (req.user.email) {
      try {
        await sendTaskAssignedConfirmationEmail(
          req.user.email,
          req.user.name,
          { title: task.title, description: task.description, priority: task.priority, deadline: task.deadline, taskId: task._id },
          toUser.name || toUserId,
        );
      } catch (emailError) {
        console.error("Failed to send reassignment confirmation email:", emailError);
      }
    }

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} reassigned task "${task.title}" from ${fromUserId} to ${toUserId}`,
      entityId: task._id,
      entityType: "Task",
    });

    const updatedTask = await Task.findById(task._id).lean().populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const escalateTask = async (req, res) => {
  try {
    const { escalatedTo, reason } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    const escalateeUser = await User.findById(escalatedTo).lean().select("_id name email");
    if (!escalateeUser) {
      return res.status(400).json({ success: false, message: `User does not exist: ${escalatedTo}` });
    }

    task.escalated = true;
    task.escalatedTo = escalatedTo;
    task.escalatedAt = new Date();
    task.escalationReason = reason;
    task.priority = "Critical";
    await task.save();

    await Notification.create({
      recipient: escalatedTo,
      sender: req.user._id,
      title: "Task Escalated",
      message: `Task "${task.title}" has been escalated to you. Reason: ${reason}`,
      type: "task_updated",
      priority: "High",
      entityId: task._id,
      entityType: "Task",
      actionUrl: buildActionUrl(task._id),
    });

    if (escalateeUser.email) {
      try {
        await sendTaskEscalationEmail(
          escalateeUser.email,
          escalateeUser.name,
          { title: task.title, description: task.description, deadline: task.deadline, taskId: task._id },
          reason,
        );
      } catch (emailError) {
        console.error("Failed to send escalation email:", emailError);
      }
    }
    if (req.user.email) {
      try {
        await sendTaskAssignedConfirmationEmail(
          req.user.email,
          req.user.name,
          { title: task.title, description: `Escalated to ${escalateeUser?.name || escalatedTo}. Reason: ${reason}`, priority: "Critical", deadline: task.deadline, taskId: task._id },
          escalateeUser?.name || escalatedTo,
        );
      } catch (emailError) {
        console.error("Failed to send escalation confirmation email:", emailError);
      }
    }

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} escalated task "${task.title}" to ${escalatedTo}`,
      entityId: task._id,
      entityType: "Task",
    });

    const updatedTask = await Task.findById(task._id).lean().populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "escalatedTo", select: "name email role" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    task.comments.push({
      user: req.user._id,
      text,
      createdAt: new Date(),
    });
    await task.save();

    let commentMessage = null;
    try {
      commentMessage = await notifyCommentAdded(task._id, req.user._id, req.user.name, text);
    } catch (e) {
      console.error("Failed to create comment system message:", e);
    }

    let commentConversation = null;
    if (commentMessage) {
      try {
        const Conversation = (await import("../models/Conversation.js")).default;
        commentConversation = await Conversation.findOne({ taskId: task._id }).select("_id").lean();
      } catch (e) {
        console.error("Failed to find conversation:", e);
      }
    }

    const otherAssignees = task.assignedTo.filter(
      (id) => id.toString() !== req.user._id.toString(),
    );
    for (const assigneeId of otherAssignees) {
      await Notification.create({
        recipient: assigneeId,
        sender: req.user._id,
        title: "New Comment",
        message: `${req.user.name} commented on task "${task.title}"`,
        type: "task_updated",
        entityId: task._id,
        entityType: "Task",
        actionUrl: buildActionUrl(task._id, commentMessage?._id),
        conversationId: commentConversation?._id,
        messageId: commentMessage?._id,
      });
    }

    try {
      const Activity = (await import("../models/Activity.js")).default;
      await Activity.create({
        user: req.user._id,
        type: "task_updated",
        description: `${req.user.name} commented on task "${task.title}"`,
        entityId: task._id,
        entityType: "Task",
      });
    } catch (e) {
      console.error("Failed to create comment activity:", e);
    }

    const updatedTask = await Task.findById(task._id).lean().populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "comments.user", select: "name email role avatar" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(201).json({ success: true, task: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
