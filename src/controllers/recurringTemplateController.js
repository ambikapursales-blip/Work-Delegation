import RecurringTemplate from "../models/RecurringTemplate.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import { calculateFirstGenerationDate, calculateNextGenerationDate } from "../utils/taskGenerationEngine.js";

export const getTemplates = async (req, res) => {
  try {
    const {
      isActive,
      taskType,
      assignedBy,
      page = 1,
      limit = 20,
      search,
    } = req.query;

    let query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    if (taskType) query.taskType = taskType;
    if (assignedBy) query.assignedBy = assignedBy;

    // Normal users (no Master Task management permission) may only see
    // templates assigned to themselves. Backend-enforced, like /api/master-tasks.
    if (req.user.role !== "Super Admin" && !req.user.canAssignTasks) {
      query.assignedTo = req.user._id;
    }

    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await RecurringTemplate.countDocuments(query);
    const templates = await RecurringTemplate.find(query)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: templates.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      templates,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTemplate = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar" },
        { path: "assignedBy", select: "name email role" },
      ]);

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const isAssigner =
      template.assignedBy?.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAssigner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view this template" });
    }

    res.status(200).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      assignedTo,
      department,
      tags,
      taskType,
      category,
      recurrencePattern,
      startDate,
      endDate,
      defaultDeadlineHours,
    } = req.body;

    if (!assignedTo || assignedTo.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Template must be assigned to at least one user",
      });
    }

    if (taskType !== "One Time" && !recurrencePattern) {
      return res.status(400).json({
        success: false,
        message: "Recurrence pattern is required for recurring task types",
      });
    }

    // Prevent duplicate: check for existing non-deleted template with same title
    const existingTemplate = await RecurringTemplate.findOne({
      title: title.trim(),
      status: { $ne: "Deleted" },
    }).select("_id createdAt").lean();
    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message: `A template with title "${title}" already exists (created ${new Date(existingTemplate.createdAt).toLocaleDateString("en-IN")})`,
      });
    }

    const scheduledHour = 9;
    const scheduledMinute = 0;
    const timezone = "Asia/Kolkata";

    const effectiveStart = new Date(startDate);

    const templateData = {
      title,
      description,
      priority,
      assignedTo,
      assignedBy: req.user._id,
      department,
      tags,
      taskType,
      category,
      recurrencePattern,
      startDate: effectiveStart,
      isActive: true,
      scheduledHour,
      scheduledMinute,
      timezone,
      nextGenerationDate: calculateFirstGenerationDate({
        taskType,
        recurrencePattern,
        startDate: effectiveStart,
        scheduledHour,
        scheduledMinute,
      }),
      generatedCount: 0,
    };

    if (endDate) {
      templateData.endDate = new Date(endDate);
    }

    if (defaultDeadlineHours) {
      templateData.defaultDeadlineHours = defaultDeadlineHours;
    }

    const template = await RecurringTemplate.create(templateData);

    await Activity.create({
      user: req.user._id,
      type: "task_created",
      description: `${req.user.name} created recurring template "${title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    const populatedTemplate = await RecurringTemplate.findById(template._id)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
      ]);

    res.status(201).json({ success: true, template: populatedTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const isAssigner =
      template.assignedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAssigner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to update this template" });
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
    } = req.body;

    if (title) template.title = title;
    if (description) template.description = description;
    if (priority) template.priority = priority;
    if (assignedTo) template.assignedTo = assignedTo;
    if (department) template.department = department;
    if (tags) template.tags = tags;
    if (category) template.category = category;
    if (endDate !== undefined) {
      template.endDate = endDate ? new Date(endDate) : null;
    }
    if (defaultDeadlineHours !== undefined) {
      template.defaultDeadlineHours = defaultDeadlineHours;
    }
    if (scheduledHour !== undefined) template.scheduledHour = scheduledHour;
    if (scheduledMinute !== undefined) template.scheduledMinute = scheduledMinute;
    if (startDate !== undefined) template.startDate = new Date(startDate);

    // Recalculate next generation date if any scheduling-related field changed
    if (recurrencePattern || scheduledHour !== undefined || scheduledMinute !== undefined || startDate !== undefined) {
      template.nextGenerationDate = calculateNextGenerationDate(template);
    }

    await template.save();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} updated recurring template "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    const updatedTemplate = await RecurringTemplate.findById(template._id)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
      ]);

    res.status(200).json({ success: true, template: updatedTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { deleteOccurrences } = req.query;
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const isAssigner =
      template.assignedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAssigner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to delete this template" });
    }

    // Optionally delete generated tasks (never the parent task)
    if (deleteOccurrences === "true") {
      await Task.deleteMany({ templateId: template._id, isGeneratedOccurrence: true });
    } else {
      // Keep tasks but remove template reference from generated occurrences
      await Task.updateMany(
        { templateId: template._id, isGeneratedOccurrence: true },
        { $unset: { templateId: 1 } },
      );
    }

    await template.deleteOne();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} deleted recurring template "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({
      success: true,
      message: deleteOccurrences === "true"
        ? "Template and all generated tasks deleted successfully"
        : "Template deleted successfully, generated tasks preserved",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTemplateOccurrences = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const isAssigner =
      template.assignedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAssigner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view this template" });
    }

    const { status, page = 1, limit = 20 } = req.query;

    let query = { templateId: template._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .lean()
      .populate([
        { path: "assignedTo", select: "name email role avatar employeeId" },
        { path: "assignedBy", select: "name email role" },
      ])
      .sort({ occurrenceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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

export const pauseTemplate = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const isAssigner =
      template.assignedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAssigner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to pause this template" });
    }

    template.status = "Paused";
    template.isActive = false;
    await template.save();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} paused recurring template "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const resumeTemplate = async (req, res) => {
  try {
    const template = await RecurringTemplate.findById(req.params.id);
    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not found" });
    }

    // Authorization check
    const isSuperAdmin = req.user.role === "Super Admin";
    const isAssigner =
      template.assignedBy.toString() === req.user._id.toString();

    if (!isSuperAdmin && !isAssigner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to resume this template" });
    }

    // Restore status — isActive will be synced by pre-save hook
    template.status = template.taskType === "One Time" ? "Scheduled" : "Active";
    template.isActive = true;
    template.nextGenerationDate = calculateNextGenerationDate(
      template,
      template.lastGeneratedDate || template.startDate || new Date(),
    );
    await template.save();

    await Activity.create({
      user: req.user._id,
      type: "task_updated",
      description: `${req.user.name} resumed recurring template "${template.title}"`,
      entityId: template._id,
      entityType: "RecurringTemplate",
    });

    res.status(200).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
