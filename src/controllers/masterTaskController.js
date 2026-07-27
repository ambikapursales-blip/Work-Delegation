import RecurringTemplate from "../models/RecurringTemplate.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { calculateNextGenerationDate, generateTaskFromTemplate, updateTemplateAfterGeneration, calculateOccurrenceDate } from "../utils/taskGenerationEngine.js";
import { createEmailSchedule } from "../utils/emailFrequencyEngine.js";
import { buildAssigneeProgress } from "../utils/taskHelpers.js";
import { createReminderStateEntry } from "../utils/reminderEngine.js";
import { sendTaskAssignmentEmail, sendTaskAssignedConfirmationEmail } from "../utils/emailService.js";
import { generateCompleteToken } from "../utils/completeToken.js";
import { generateCommentToken } from "../utils/commentToken.js";
import { generateExtensionToken } from "../utils/extensionToken.js";
import { buildActionUrl } from "../utils/conversationAuth.js";
import { notifyTaskAssigned } from "../utils/conversationMessages.js";

export const getMasterTasks = async (req, res) => {
  try {
    const {
      status,
      taskType,
      assignedTo,
      assignedBy,
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = -1,
    } = req.query;

    let query = { status: { $ne: "Deleted" } };

    if (status) {
      if (status === "All") {
        query.status = { $in: ["Active", "Paused"] };
      } else {
        query.status = status;
      }
    }
    if (taskType) query.taskType = taskType;
    if (assignedTo) query.assignedTo = assignedTo;
    if (assignedBy) query.assignedBy = assignedBy;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = parseInt(sortOrder);

    const projection = "title description taskType status assignedTo assignedBy lastGeneratedDate nextGenerationDate generatedCount createdAt";

    const [total, templates] = await Promise.all([
      RecurringTemplate.countDocuments(query),
      RecurringTemplate.find(query)
        .select(projection)
        .lean()
        .populate([
          { path: "assignedTo", select: "name email role avatar employeeId" },
          { path: "assignedBy", select: "name email role" },
        ])
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
    ]);

    res.status(200).json({
      success: true,
      count: templates.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      masterTasks: templates,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMasterTask = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
        { path: "pausedBy", select: "name email" },
        { path: "deletedBy", select: "name email" },
      ]);

    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    // Fetch operational stats in a single aggregate (replaces 3 countDocuments)
    const statsResult = await Task.aggregate([
      { $match: { templateId: template._id, isGeneratedOccurrence: true } },
      {
        $group: {
          _id: null,
          completed: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ["$status", ["In Progress", "On Hold"]] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ["$status", "Overdue"] }, 1, 0] } },
        },
      },
    ]);
    const stats = statsResult[0] || {};
    const completedCount = stats.completed || 0;
    const pendingCount = stats.pending || 0;
    const failedCount = stats.overdue || 0;

    res.status(200).json({
      success: true,
      masterTask: {
        ...template,
        operationalStats: {
          completedCount,
          pendingCount,
          failedCount,
          totalGenerated: template.generatedCount || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createMasterTask = async (req, res) => {
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
      taskType = "Daily",
      category,
      recurrencePattern,
      recurrenceEndDate,
      scheduledHour = 9,
      scheduledMinute = 0,
      timezone = "Asia/Kolkata",
      repeatForever,
      defaultDeadlineHours,
      checklist,
      attachments,
    } = req.body;

    if (!assignedTo || assignedTo.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Master task must be assigned to at least one user",
      });
    }

    if (!recurrencePattern) {
      return res.status(400).json({
        success: false,
        message: "Recurrence pattern is required for master tasks",
      });
    }

    const assignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const assigneeUsers = await User.find({ _id: { $in: assignees } })
      .lean()
      .select("_id name email");
    const validIds = new Set(assigneeUsers.map((u) => u._id.toString()));
    const invalidIds = assignees.filter((id) => !validIds.has(id.toString()));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following assigned user(s) do not exist: ${invalidIds.join(", ")}`,
      });
    }

    const now = new Date();
    const nextGenDate = calculateNextGenerationDate(
      {
        taskType,
        recurrencePattern,
        startDate: now,
        scheduledHour,
        scheduledMinute,
      },
      now,
    );

    const templateData = {
      title,
      description,
      priority: priority || "Medium",
      department,
      tags,
      assignedTo: assignees,
      assignedBy: req.user._id,
      category,
      taskType,
      recurrencePattern,
      status: "Active",
      isActive: true,
      startDate: now,
      endDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
      repeatForever: repeatForever !== undefined ? repeatForever : !recurrenceEndDate,
      scheduledHour,
      scheduledMinute,
      timezone,
      nextGenerationDate: nextGenDate,
      generatedCount: 0,
      defaultDeadlineHours: defaultDeadlineHours || null,
      lastGeneratedDate: null,
    };

    const template = await RecurringTemplate.create(templateData);

    // Immediately generate the first occurrence
    // Atomic guard: after generation, nextGenerationDate is advanced,
    // so cron's generateDueTasks will NOT pick up this template
    let firstOccurrence = null;
    try {
      const occurrenceDate = calculateOccurrenceDate(template, now);
      firstOccurrence = await generateTaskFromTemplate(template, occurrenceDate, 1);
      await updateTemplateAfterGeneration(template);
    } catch (genError) {
      console.error("[MasterTask] Failed to generate first occurrence:", genError);
    }

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} created master task "${title}" (${taskType})`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    // Populate the existing template document (avoids a second findById query)
    await template.populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
    ]);

    res.status(201).json({
      success: true,
      masterTask: template.toObject(),
      firstOccurrence: firstOccurrence || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMasterTask = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    const {
      title,
      description,
      priority,
      assignedTo,
      department,
      tags,
      category,
      recurrencePattern,
      endDate,
      defaultDeadlineHours,
      scheduledHour,
      scheduledMinute,
      startDate,
      repeatForever,
    } = req.body;

    // Only update metadata — NEVER touch historical occurrences
    if (title) template.title = title;
    if (description !== undefined) template.description = description;
    if (priority) template.priority = priority;
    if (assignedTo) template.assignedTo = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    if (department) template.department = department;
    if (tags) template.tags = tags;
    if (category) template.category = category;
    if (endDate !== undefined) template.endDate = endDate ? new Date(endDate) : null;
    if (defaultDeadlineHours !== undefined) template.defaultDeadlineHours = defaultDeadlineHours;
    if (scheduledHour !== undefined) template.scheduledHour = scheduledHour;
    if (scheduledMinute !== undefined) template.scheduledMinute = scheduledMinute;
    if (startDate !== undefined) template.startDate = new Date(startDate);
    if (repeatForever !== undefined) template.repeatForever = repeatForever;

    if (recurrencePattern) {
      template.recurrencePattern = recurrencePattern;
    }

    // Only recalculate future schedule — never regenerate past occurrences
    const schedulingChanged = recurrencePattern || scheduledHour !== undefined || scheduledMinute !== undefined || startDate !== undefined;
    if (schedulingChanged) {
      // Use lastGeneratedDate as the anchor so already-generated dates are untouched
      const anchor = template.lastGeneratedDate || template.startDate || new Date();
      template.nextGenerationDate = calculateNextGenerationDate(template, anchor);
    }

    await template.save();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} updated master task "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    await template.populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
    ]);

    res.status(200).json({ success: true, masterTask: template.toObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMasterTask = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    // Soft delete: mark status as Deleted
    template.status = "Deleted";
    template.isActive = false;
    template.deletedAt = new Date();
    template.deletedBy = req.user._id;
    await template.save();

    // Collect IDs of all non-completed generated occurrences (uses covered index)
    const futureOccurrences = await Task.find({
      templateId: template._id,
      isGeneratedOccurrence: true,
      status: { $nin: ["Completed"] },
    }).select("_id").lean();
    const futureIds = futureOccurrences.map(t => t._id);

    // Delete future pending occurrences (keep completed history)
    if (futureIds.length > 0) {
      // Parallelize independent cleanup operations
      await Promise.all([
        Task.deleteMany({ _id: { $in: futureIds } }),
        Notification.deleteMany({
          entityId: { $in: futureIds },
          entityType: "Task",
        }),
        Activity.deleteMany({
          entityId: { $in: futureIds },
          entityType: "Task",
        }),
        Message.deleteMany({ taskId: { $in: futureIds } }),
      ]);

      // Delete conversations separately (need their _ids for the count)
      const convIds = await Conversation.distinct("_id", { taskId: { $in: futureIds } });
      if (convIds.length > 0) {
        await Conversation.deleteMany({ _id: { $in: convIds } });
      }
    } else {
      // Even with no future occurrences, still clean up activities (safe no-op with empty array)
      await Activity.deleteMany({
        entityId: { $in: futureIds },
        entityType: "Task",
      });
    }

    // Also remove any action-center-like pending entries
    // (Extension requests on deleted tasks are handled by task deletion cascade)

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} deleted master task "${template.title}" - recurring series stopped`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({
      success: true,
      message: "Master task deleted. Recurring series stopped. Completed history preserved.",
    });
  } catch (error) {
    console.error("[MasterTask] deleteMasterTask error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const hardDeleteMasterTask = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    // Deactivate template
    template.isActive = false;
    template.status = "Deleted";
    template.deletedAt = new Date();
    template.deletedBy = req.user._id;
    await template.save();

    // Delete future pending occurrences
    await Task.deleteMany({
      templateId: template._id,
      isGeneratedOccurrence: true,
      status: { $nin: ["Completed"] },
    });

    await template.deleteOne();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} permanently deleted master task "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({
      success: true,
      message: "Master task permanently deleted.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const pauseMasterTask = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    template.status = "Paused";
    template.isActive = false;
    template.pausedAt = new Date();
    template.pausedBy = req.user._id;
    await template.save();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} paused master task "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({ success: true, masterTask: template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const resumeMasterTask = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    template.status = "Active";
    template.isActive = true;
    template.pausedAt = null;
    template.pausedBy = null;

    // Resume from the LAST GENERATED date — NOT from current time.
    // This avoids backfilling missed occurrences during the pause period.
    // The next generation will be the NEXT scheduled slot after lastGeneratedDate.
    const resumeAnchor = template.lastGeneratedDate || template.startDate || new Date();
    template.nextGenerationDate = calculateNextGenerationDate(template, resumeAnchor);

    await template.save();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} resumed master task "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({ success: true, masterTask: template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const cloneMasterTask = async (req, res) => {
  try {
    const source = await RecurringTemplate.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    const now = new Date();

    // Clone only configuration fields — RESET all runtime/state fields
    const cloneData = {
      title: `${source.title} (Clone)`,
      description: source.description,
      priority: source.priority,
      department: source.department,
      tags: [...(source.tags || [])],
      assignedTo: [...source.assignedTo],
      assignedBy: req.user._id,
      category: source.category,
      taskType: source.taskType,
      recurrencePattern: JSON.parse(JSON.stringify(source.recurrencePattern)),
      status: "Active",
      isActive: true,
      startDate: now,
      endDate: source.endDate ? new Date(source.endDate) : null,
      repeatForever: source.repeatForever,
      scheduledHour: source.scheduledHour,
      scheduledMinute: source.scheduledMinute,
      timezone: source.timezone || "Asia/Kolkata",
      defaultDeadlineHours: source.defaultDeadlineHours,

      // Hard-reset all runtime fields — MUST NOT copy any state
      generatedCount: 0,
      lastGeneratedDate: null,
      nextGenerationDate: calculateNextGenerationDate(
        {
          taskType: source.taskType,
          recurrencePattern: source.recurrencePattern,
          startDate: now,
          scheduledHour: source.scheduledHour,
          scheduledMinute: source.scheduledMinute,
        },
        now,
      ),
      pausedAt: null,
      pausedBy: null,
      deletedAt: null,
      deletedBy: null,
    };

    const cloned = await RecurringTemplate.create(cloneData);

    // Generate first occurrence for the clone — only once
    let firstOccurrence = null;
    try {
      const occurrenceDate = calculateOccurrenceDate(cloned, now);
      firstOccurrence = await generateTaskFromTemplate(cloned, occurrenceDate, 1);
      await updateTemplateAfterGeneration(cloned);
    } catch (genError) {
      console.error("[MasterTask] Failed to generate clone first occurrence:", genError);
    }

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} cloned master task "${source.title}" as "${cloned.title}"`,
      entityId: cloned._id,
      entityType: "RecurringTemplate",
    });

    const populated = await RecurringTemplate.findById(cloned._id)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
      ]);

    res.status(201).json({ success: true, masterTask: populated, firstOccurrence: firstOccurrence || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMasterTaskHistory = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id).select("_id").lean();
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    const { page = 1, limit = 20, status } = req.query;

    let query = { templateId: template._id, isGeneratedOccurrence: true };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [total, occurrences] = await Promise.all([
      Task.countDocuments(query),
      Task.find(query)
        .select("title status occurrenceDate occurrenceNumber assignedTo assignedBy")
        .lean()
        .populate([
          { path: "assignedTo", select: "name email role avatar employeeId" },
          { path: "assignedBy", select: "name email role" },
        ])
        .sort({ occurrenceDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
    ]);

    res.status(200).json({
      success: true,
      count: occurrences.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      occurrences,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMasterTaskStats = async (req, res) => {
  try {
    // Single aggregate replaces 3 countDocuments + 1 aggregate
    const stats = await RecurringTemplate.aggregate([
      { $match: { status: { $ne: "Deleted" } } },
      {
        $group: {
          _id: "$taskType",
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
          paused: { $sum: { $cond: [{ $eq: ["$status", "Paused"] }, 1, 0] } },
        },
      },
    ]);

    // Compute totals from the aggregate results (avoids 3 separate countDocuments)
    let totalAll = 0, totalActive = 0, totalPaused = 0;
    for (const s of stats) {
      totalAll += s.count;
      totalActive += s.active;
      totalPaused += s.paused;
    }

    res.status(200).json({
      success: true,
      stats: {
        total: totalAll,
        active: totalActive,
        paused: totalPaused,
        byType: stats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteOccurrence = async (req, res) => {
  try {
    const task = await Task.findById(req.params.occurrenceId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Occurrence not found" });
    }

    if (!task.isGeneratedOccurrence) {
      return res.status(400).json({ success: false, message: "This task is not a generated occurrence" });
    }

    // Only delete this single occurrence — series continues
    // Do NOT touch template, nextGenerationDate, generatedCount, or occurrenceNumber
    const templateId = task.templateId;
    await task.deleteOne();

    // Clean up associated notifications for this occurrence
    await Notification.deleteMany({
      entityId: task._id,
      entityType: "Task",
    });

    res.status(200).json({
      success: true,
      message: "Occurrence deleted. Recurring series continues.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};