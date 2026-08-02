import RecurringTemplate from "../models/RecurringTemplate.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { calculateFirstGenerationDate, calculateNextGenerationDate, generateTaskFromTemplate, updateTemplateAfterGeneration, calculateOccurrenceDate, generateNow } from "../utils/taskGenerationEngine.js";
import { createEmailSchedule } from "../utils/emailFrequencyEngine.js";
import { buildAssigneeProgress } from "../utils/taskHelpers.js";
import { createReminderStateEntry } from "../utils/reminderEngine.js";
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
      createdFrom,
      createdTo,
      nextGenerationFrom,
      nextGenerationTo,
      generatedCount,
      sortBy = "newest",
    } = req.query;

    let query = { status: { $ne: "Deleted" } };

    if (status) {
      if (status === "All") {
        query.status = { $in: ["Active", "Paused", "Scheduled", "Completed"] };
      } else if (status === "Generated") {
        query.status = "Completed";
      } else {
        query.status = status;
      }
    }
    if (taskType) query.taskType = taskType;
    if (assignedTo) query.assignedTo = assignedTo;
    if (assignedBy) query.assignedBy = assignedBy;

    // Normal users (no Master Task management permission) may only see
    // Master Tasks assigned to themselves. This is enforced on the backend —
    // any client-supplied assignedTo filter is ignored for them.
    if (req.user.role !== "Super Admin" && !req.user.canAssignTasks) {
      query.assignedTo = req.user._id;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (createdFrom || createdTo) {
      query.createdAt = {};
      if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
      if (createdTo) query.createdAt.$lte = new Date(createdTo);
    }

    if (nextGenerationFrom || nextGenerationTo) {
      query.nextGenerationDate = {};
      if (nextGenerationFrom) query.nextGenerationDate.$gte = new Date(nextGenerationFrom);
      if (nextGenerationTo) query.nextGenerationDate.$lte = new Date(nextGenerationTo);
    }
    if (req.query.nextGeneration === "none") {
      query.nextGenerationDate = null;
    }

    if (generatedCount) {
      if (generatedCount === "never") {
        query.generatedCount = 0;
      } else if (generatedCount === "once") {
        query.generatedCount = 1;
      } else if (generatedCount === "multiple") {
        query.generatedCount = { $gte: 2 };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name_asc: { title: 1 },
      name_desc: { title: -1 },
      nextGen_asc: { nextGenerationDate: 1 },
      nextGen_desc: { nextGenerationDate: -1 },
      most_gen: { generatedCount: -1 },
      least_gen: { generatedCount: 1 },
    };
    const sortObj = sortMap[sortBy] || { createdAt: -1 };

    const projection = "title description taskType priority department status assignedTo assignedBy startDate lastGeneratedDate nextGenerationDate generatedCount deadline createdAt attachmentUrl";

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

    // Aggregate per-template activity (planning-layer audit trail)
    const templateIds = templates.map((t) => t._id);
    let activityMap = {};
    if (templateIds.length > 0) {
      const lastActivities = await Activity.aggregate([
        { $match: { entityId: { $in: templateIds }, entityType: "RecurringTemplate" } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$entityId", lastActivity: { $first: "$createdAt" }, lastActivityDesc: { $first: "$description" } } },
      ]);
      lastActivities.forEach((a) => {
        activityMap[a._id.toString()] = { lastActivity: a.lastActivity, lastActivityDesc: a.lastActivityDesc };
      });
    }

    // Enrich templates with planning-layer metadata only
    const enriched = templates.map((t) => {
      const id = t._id.toString();
      const a = activityMap[id] || {};
      return {
        ...t,
        operationalStats: {
          totalGenerated: t.generatedCount || 0,
          lastActivity: a.lastActivity || null,
          lastActivityDesc: a.lastActivityDesc || null,
        },
      };
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      masterTasks: enriched,
    });
  } catch (error) {
    console.error("[MasterTask] getMasterTasks error:", error);
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

    // Normal users may only open Master Tasks assigned to themselves.
    if (req.user.role !== "Super Admin" && !req.user.canAssignTasks) {
      const isAssigned = Array.isArray(template.assignedTo) &&
        template.assignedTo.some((a) =>
          (a._id ? a._id.toString() : a.toString()) === req.user._id.toString(),
        );
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Not authorized to view this master task" });
      }
    }

    res.status(200).json({
      success: true,
      masterTask: {
        ...template,
        operationalStats: {
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
      startDate,
      scheduledHour = 9,
      scheduledMinute = 0,
      timezone = "Asia/Kolkata",
      repeatForever,
      defaultDeadlineHours,
      checklist,
      attachments,
      attachmentUrl,
    } = req.body;

    if (!assignedTo || assignedTo.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Master task must be assigned to at least one user",
      });
    }

    const isOneTime = taskType === "One Time";

    if (!isOneTime && !recurrencePattern) {
      return res.status(400).json({
        success: false,
        message: "Recurrence pattern is required for recurring master tasks",
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
    const effectiveStart = startDate ? new Date(startDate) : now;
    const isFutureStart = effectiveStart > now;

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
      recurrencePattern: isOneTime ? undefined : recurrencePattern,
      status: isOneTime ? "Scheduled" : "Active",
      startDate: effectiveStart,
      endDate: isOneTime ? null : (recurrenceEndDate ? new Date(recurrenceEndDate) : null),
      repeatForever: isOneTime ? false : (repeatForever !== undefined ? repeatForever : !recurrenceEndDate),
      scheduledHour: scheduledHour || 9,
      scheduledMinute: scheduledMinute || 0,
      timezone,
      nextGenerationDate: calculateFirstGenerationDate({
        taskType,
        recurrencePattern,
        startDate: effectiveStart,
        scheduledHour,
        scheduledMinute,
      }),
      deadline: isOneTime ? (deadline ? new Date(deadline) : undefined) : undefined,
      generatedCount: 0,
      defaultDeadlineHours: defaultDeadlineHours || null,
      lastGeneratedDate: null,
      attachmentUrl: attachmentUrl ? attachmentUrl.trim() : null,
    };

    const template = await RecurringTemplate.create(templateData);

    // Generate first occurrence immediately if startDate is today or in the past.
    // One-time tasks also auto-generate so they appear in /tasks right away.
    let firstOccurrence = null;
    if (!isFutureStart) {
      try {
        const occurrenceDate = calculateOccurrenceDate(template, now);
        firstOccurrence = await generateTaskFromTemplate(template, occurrenceDate, 1);
        await updateTemplateAfterGeneration(template);
      } catch (genError) {
        console.error("[MasterTask] Failed to generate first occurrence:", genError);
      }
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
      ...(firstOccurrence ? { firstOccurrence } : {}),
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
      deadline,
      attachmentUrl,
    } = req.body;

    const isOneTime = template.taskType === "One Time";

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
    if (deadline !== undefined) template.deadline = deadline ? new Date(deadline) : null;
    if (attachmentUrl !== undefined) template.attachmentUrl = attachmentUrl ? attachmentUrl.trim() : null;

    if (recurrencePattern) {
      template.recurrencePattern = recurrencePattern;
    }

    // Only recalculate future schedule — never regenerate past occurrences
    if (!isOneTime) {
      const schedulingChanged = recurrencePattern || scheduledHour !== undefined || scheduledMinute !== undefined || startDate !== undefined;
      if (schedulingChanged) {
        if (template.lastGeneratedDate) {
          // Recalculate from the last generated date so already-generated dates are untouched
          template.nextGenerationDate = calculateNextGenerationDate(template, template.lastGeneratedDate);
        } else {
          // No occurrences yet — use first-generation logic (handles future start dates)
          template.nextGenerationDate = calculateFirstGenerationDate(template);
        }
      }
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

    // Soft delete: mark status as Deleted (isActive synced by pre-save hook)
    template.status = "Deleted";
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

    const isOneTime = template.taskType === "One Time";
    template.status = isOneTime ? "Scheduled" : "Active";
    template.pausedAt = null;
    template.pausedBy = null;

    let autoGenerated = false;

    if (isOneTime) {
      const now = new Date();
      const effectiveStart = template.startDate ? new Date(template.startDate) : now;

      if (template.generatedCount === 0 && effectiveStart <= now) {
        // Never generated and scheduled date has arrived → auto-generate now
        template.nextGenerationDate = null;
        try {
          const occurrenceDate = calculateOccurrenceDate(template, now);
          await generateTaskFromTemplate(template, occurrenceDate, 1);
          await updateTemplateAfterGeneration(template);
          autoGenerated = true;
        } catch (genError) {
          console.error("[MasterTask] Failed to auto-generate on resume:", genError);
        }
      } else if (effectiveStart > now) {
        // Future start → restore nextGenerationDate for cron
        template.nextGenerationDate = calculateFirstGenerationDate(template);
      } else {
        // Already generated or edge case — keep null
        // The template was already generated once; never generate again
        template.nextGenerationDate = null;
      }
    } else {
      // Resume from the LAST GENERATED date — NOT from current time.
      // This avoids backfilling missed occurrences during the pause period.
      if (template.lastGeneratedDate) {
        template.nextGenerationDate = calculateNextGenerationDate(template, template.lastGeneratedDate);
      } else {
        // No occurrences yet — preserve the first-generation schedule (handles future start dates)
        template.nextGenerationDate = calculateFirstGenerationDate(template);
      }
    }

    if (!autoGenerated) {
      await template.save();
    }

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
    const isOneTime = source.taskType === "One Time";

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
      status: isOneTime ? "Scheduled" : "Active",
      startDate: now,
      endDate: isOneTime ? null : (source.endDate ? new Date(source.endDate) : null),
      repeatForever: isOneTime ? false : source.repeatForever,
      scheduledHour: source.scheduledHour,
      scheduledMinute: source.scheduledMinute,
      timezone: source.timezone || "Asia/Kolkata",
      defaultDeadlineHours: source.defaultDeadlineHours,

      // Hard-reset all runtime fields — MUST NOT copy any state
      generatedCount: 0,
      lastGeneratedDate: null,
      nextGenerationDate: isOneTime ? null : calculateFirstGenerationDate({
        taskType: source.taskType,
        recurrencePattern: source.recurrencePattern,
        startDate: now,
        scheduledHour: source.scheduledHour,
        scheduledMinute: source.scheduledMinute,
      }),
      pausedAt: null,
      pausedBy: null,
      deletedAt: null,
      deletedBy: null,
    };

    const cloned = await RecurringTemplate.create(cloneData);

    // Generate first occurrence for the clone
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
    const template = await RecurringTemplate.findById(req.params.id).select("_id assignedTo").lean();
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    // Normal users may only view history of Master Tasks assigned to themselves.
    if (req.user.role !== "Super Admin" && !req.user.canAssignTasks) {
      const isAssigned = Array.isArray(template.assignedTo) &&
        template.assignedTo.some((id) =>
          (id._id ? id._id.toString() : id.toString()) === req.user._id.toString(),
        );
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: "Not authorized to view this master task's history" });
      }
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
    const stats = await RecurringTemplate.aggregate([
      { $match: { status: { $ne: "Deleted" } } },
      {
        $group: {
          _id: "$taskType",
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
          scheduled: { $sum: { $cond: [{ $eq: ["$status", "Scheduled"] }, 1, 0] } },
          paused: { $sum: { $cond: [{ $eq: ["$status", "Paused"] }, 1, 0] } },
          generated: { $sum: { $cond: [{ $eq: ["$status", "Generated"] }, 1, 0] } },
        },
      },
    ]);

    let totalAll = 0, totalActive = 0, totalScheduled = 0, totalPaused = 0, totalGenerated = 0;
    for (const s of stats) {
      totalAll += s.count;
      totalActive += s.active;
      totalScheduled += s.scheduled;
      totalPaused += s.paused;
      totalGenerated += s.generated;
    }

    const result = {
      total: totalAll,
      active: totalActive,
      scheduled: totalScheduled,
      paused: totalPaused,
      generated: totalGenerated,
      byType: stats,
    };

    res.status(200).json({
      success: true,
      stats: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const generateMasterTaskNow = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Master task not found" });
    }

    if (template.status === "Generated") {
      return res.status(400).json({ success: false, message: "One-time master task has already been generated" });
    }

    if (template.status === "Paused" || template.status === "Deleted") {
      return res.status(400).json({ success: false, message: "Master task is paused or deleted" });
    }

    const task = await generateNow(template);
    if (!task) {
      return res.status(400).json({ success: false, message: "Could not generate task from this template" });
    }

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} generated task "${task.title}" from master task "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    // Populate template for response
    await template.populate([
      { path: "assignedTo", select: "name email role avatar employeeId" },
      { path: "assignedBy", select: "name email role" },
    ]);

    res.status(200).json({
      success: true,
      masterTask: template.toObject(),
      generatedTask: task,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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