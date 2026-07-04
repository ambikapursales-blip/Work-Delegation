import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { generateNextTaskOccurrence } from "../utils/cronJobs.js";
import {
  sendTaskAssignmentEmail,
  sendTaskCompletionEmail,
} from "../utils/emailService.js";

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
    } = req.query;

    let query = {};

    if (["Sales Executive", "Coordinator", "HR"].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    } else if (req.user.role === "Manager") {
      const teamMembers = await User.find({ managerId: req.user._id }).select(
        "_id",
      );
      const teamIds = teamMembers.map((m) => m._id);
      teamIds.push(req.user._id);
      query.$or = [
        { assignedTo: { $in: teamIds } },
        { assignedBy: req.user._id },
      ];
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
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
      taskType = "One-time",
      isRecurring = false,
      recurrencePattern = null,
      recurrenceEndDate = null,
    } = req.body;

    const assignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

    if (isRecurring && !recurrencePattern) {
      return res.status(400).json({
        success: false,
        message: "Recurrence pattern is required for recurring tasks",
      });
    }

    const assigneeProgress = assignees.map((userId) => ({
      user: userId,
      status: "Pending",
      actualHours: 0,
    }));

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
      isRecurring,
      history: [
        { status: "Pending", changedBy: req.user._id, note: "Task created" },
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

    const assigneeUsers = await User.find({ _id: { $in: assignees } }).lean().select("_id name email");
    const recurringText = isRecurring ? ` (${taskType})` : "";
    for (const assignee of assigneeUsers) {
      await Notification.create({
        recipient: assignee._id,
        sender: req.user._id,
        title: "New Task Assigned",
        message: `You have been assigned a new task: "${title}"${recurringText}`,
        type: "task_assigned",
        entityId: task._id,
        entityType: "Task",
        actionUrl: `/dashboard/tasks/${task._id}`,
      });

      if (assignee.email) {
        try {
          await sendTaskAssignmentEmail(assignee.email, assignee.name, {
            title,
            description,
            priority,
            deadline,
          });
        } catch (emailError) {
          // Silently fail email errors
        }
      }
    }

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} created ${isRecurring ? "recurring " : ""}task "${title}" and assigned to ${assigneeUsers.map((u) => u.name).join(", ")}`,
      entityId: task._id,
      entityType: "Task",
    });

    const populatedTask = await Task.findById(task._id).lean().populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
      { path: "assigneeProgress.user", select: "name email role" },
    ]);

    res.status(201).json({ success: true, task: populatedTask });
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
    const isAdmin = ["Admin", "HR"].includes(req.user.role);

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
    } = req.body;

    if (status) {
      const statusMap = {
        pending: "Pending",
        "in progress": "In Progress",
        inprogress: "In Progress",
        completed: "Completed",
        cancelled: "Cancelled",
        "on hold": "On Hold",
        onhold: "On Hold",
      };
      req.body.status = statusMap[status.toLowerCase()] || status;
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

      if (req.body.status === "Completed") {
        await Notification.create({
          recipient: task.assignedBy,
          sender: req.user._id,
          title: "Task Completed",
          message: `Task "${task.title}" has been marked as completed`,
          type: "task_completed",
          entityId: task._id,
          entityType: "Task",
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
          // Silently fail email errors
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
            // Silently fail task generation error
          }
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

    if (["Sales Executive", "Coordinator"].includes(req.user.role)) {
      matchQuery.assignedTo = { $in: [req.user._id] };
    }

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

    const createdTasks = [];
    const notifications = [];

    for (const taskData of tasks) {
      const assignees = Array.isArray(taskData.assignedTo)
        ? taskData.assignedTo
        : [taskData.assignedTo];
      const assigneeProgress = assignees.map((userId) => ({
        user: userId,
        status: "Pending",
        actualHours: 0,
      }));

      const task = await Task.create({
        ...taskData,
        assignedTo: assignees,
        assignedBy: req.user._id,
        assigneeProgress,
        history: [
          { status: "Pending", changedBy: req.user._id, note: "Task created" },
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
          actionUrl: `/dashboard/tasks/${task._id}`,
        });
      });
    }

    await Notification.insertMany(notifications);

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

    const notifications = [];
    const updates = [];

    for (const task of tasks) {
      const oldAssignees = [...task.assignedTo];
      const newAssignees = [...new Set([...task.assignedTo, ...userIds])];

      const newProgress = userIds
        .filter(
          (id) =>
            !task.assigneeProgress.some(
              (p) => p.user.toString() === id.toString(),
            ),
        )
        .map((userId) => ({ user: userId, status: "Pending", actualHours: 0 }));

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
            actionUrl: `/dashboard/tasks/${task._id}`,
          });
        }
      });
    }

    await Task.bulkWrite(updates);
    await Notification.insertMany(notifications);

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

    await Notification.create({
      recipient: toUserId,
      sender: req.user._id,
      title: "Task Reassigned",
      message: `Task "${task.title}" has been reassigned to you`,
      type: "task_assigned",
      entityId: task._id,
      entityType: "Task",
      actionUrl: `/dashboard/tasks/${task._id}`,
    });

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
      actionUrl: `/dashboard/tasks/${task._id}`,
    });

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
        actionUrl: `/dashboard/tasks/${task._id}`,
      });
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
