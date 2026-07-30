import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["In Progress", "Completed", "Cancelled", "On Hold", "Overdue"],
      default: "In Progress",
    },
    deadline: {
      type: Date,
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Task must be assigned to at least one user"],
      },
    ],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task must have an assigner"],
    },
    department: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    attachments: [
      {
        name: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    attachmentUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/empty
          // Validate HTTP/HTTPS URL
          try {
            const url = new URL(v.trim());
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch (e) {
            return false;
          }
        },
        message: "Attachment URL must be a valid HTTP or HTTPS URL",
      },
    },
    completedAt: {
      type: Date,
    },
    remarks: {
      type: String,
    },
    history: [
      {
        status: String,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        changedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    isOverdue: {
      type: Boolean,
      default: false,
    },
    estimatedHours: {
      type: Number,
    },
    actualHours: {
      type: Number,
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
          maxlength: 1000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    escalated: {
      type: Boolean,
      default: false,
    },
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    escalatedAt: {
      type: Date,
    },
    escalationReason: {
      type: String,
    },
    assigneeProgress: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["Pending", "In Progress", "Completed", "On Hold"],
          default: "Pending",
        },
        completedAt: {
          type: Date,
        },
        actualHours: {
          type: Number,
          default: 0,
        },
        emailOpened: {
          type: Boolean,
          default: false,
        },
        openedAt: {
          type: Date,
        },
        openCount: {
          type: Number,
          default: 0,
        },
      },
    ],
    reassignmentHistory: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        to: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reassignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reason: String,
        reassignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    taskType: {
      type: String,
      enum: [
        "One Time",
        "Daily",
        "Weekly",
        "Monthly",
        "Quarterly",
        "Half Yearly",
        "Yearly",
        "Custom",
      ],
      default: "One Time",
    },
    category: {
      type: String,
      enum: [
        "Sales",
        "HR",
        "Operations",
        "Customer Support",
        "Admin",
        "General",
        "Marketing",
        "Strategic",
      ],
      trim: true,
    },
    emailSchedule: {
      taskType: {
        type: String,
        enum: [
          "One Time",
          "Daily",
          "Weekly",
          "Monthly",
          "Quarterly",
          "Half Yearly",
          "Yearly",
          "Custom",
        ],
      },
      assignmentDate: {
        type: Date,
      },
      nextEmailDate: {
        type: Date,
      },
      lastEmailDate: {
        type: Date,
      },
      frequency: {
        type: Number, // in days
      },
    },
    reminderState: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        lastReminderAt: {
          type: Date,
        },
        nextReminderAt: {
          type: Date,
        },
        lastReminderType: {
          type: String,
          enum: ["normal", "overdue", "stopped"],
          default: "normal",
        },
        reminderCount: {
          type: Number,
          default: 0,
        },
        isPaused: {
          type: Boolean,
          default: false,
        },
        pausedReason: {
          type: String,
        },
        lastReminderStatus: {
          type: String,
        },
        lastEmailTemplate: {
          type: String,
          default: "assignment",
        },
        milestoneFlags: {
          fourDays: { type: Boolean, default: false },
          threeDays: { type: Boolean, default: false },
          twoDays: { type: Boolean, default: false },
          oneDay: { type: Boolean, default: false },
          dueToday: { type: Boolean, default: false },
        },
        lockUntil: {
          type: Date,
          default: null,
        },
      },
    ],
    deadlineAlerts: {
      fourDays: { type: Boolean, default: false },
      threeDays: { type: Boolean, default: false },
      twoDays: { type: Boolean, default: false },
      oneDay: { type: Boolean, default: false },
      dueToday: { type: Boolean, default: false },
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    recurrencePattern: {
      frequency: {
        type: String,
        enum: [
          "daily",
          "weekly",
          "biweekly",
          "monthly",
          "custom",
          "quarterly",
          "halfyearly",
          "yearly",
        ],
      },
      daysOfWeek: [
        {
          type: Number,
        },
      ],
      dayOfMonth: {
        type: Number,
      },
      interval: {
        type: Number,
        default: 1,
      },
      intervalValue: {
        type: Number,
        default: 1,
      },
      intervalUnit: {
        type: String,
        enum: ["Minutes", "Hours", "Days", "Weeks", "Months"],
      },
      customDays: [Number],
    },
    recurrenceEndDate: {
      type: Date,
    },
    nextOccurrenceDate: {
      type: Date,
    },
    lastGeneratedDate: {
      type: Date,
    },
    checklist: [
      {
        text: {
          type: String,
          required: true,
          maxlength: 500,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
        },
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    extensionRequests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        revisedTargetDate: {
          type: Date,
          required: true,
        },
        reason: {
          type: String,
          maxlength: 1000,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        respondedAt: {
          type: Date,
        },
        responseNote: {
          type: String,
          maxlength: 1000,
        },
      },
    ],
    // New fields for recurring task generation
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecurringTemplate",
    },
    occurrenceDate: {
      type: Date,
    },
    occurrenceNumber: {
      type: Number,
    },
    generatedAt: {
      type: Date,
    },
    generatedByCron: {
      type: Boolean,
      default: false,
    },
    isGeneratedOccurrence: {
      type: Boolean,
      default: false,
    },
    assignmentEmailSent: {
      type: Boolean,
      default: false,
    },
    assignmentEmailSentAt: {
      type: Date,
      default: null,
    },
    assignmentEmailStatus: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
    },
    assignmentEmailRetryCount: {
      type: Number,
      default: 0,
    },
    assignmentEmailLastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

taskSchema.virtual("daysRemaining").get(function () {
  if (!this.deadline) return null;
  const now = new Date();
  const diff = this.deadline - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

taskSchema.virtual("checklistProgress").get(function () {
  if (!this.checklist || this.checklist.length === 0) return null;
  const completed = this.checklist.filter((item) => item.completed).length;
  return Math.round((completed / this.checklist.length) * 100);
});

taskSchema.pre("save", function (next) {
  // Normalize taskType for backward compatibility
  if (this.taskType) {
    const taskTypeMap = {
      "One-time": "One Time",
      "One time": "One Time",
      "one-time": "One Time",
      "one time": "One Time",
      "half-yearly": "Half Yearly",
      "half yearly": "Half Yearly",
      "Half-Yearly": "Half Yearly",
    };
    if (taskTypeMap[this.taskType]) {
      this.taskType = taskTypeMap[this.taskType];
    }
  }

  // Deadline is required only for One Time tasks
  if (this.taskType === "One Time" && !this.deadline) {
    return next(new Error("Deadline is required for One Time tasks"));
  }

  // Overdue logic: automatically set isOverdue when deadline passed and not completed
  if (
    this.deadline &&
    this.status !== "Completed" &&
    this.status !== "Cancelled"
  ) {
    this.isOverdue = new Date() > this.deadline;
  }

  if (this.status === "Completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

taskSchema.set("toJSON", { virtuals: true });
taskSchema.set("toObject", { virtuals: true });

taskSchema.index({ assignedTo: 1, status: 1, deadline: 1 });
taskSchema.index({ assignedTo: 1, status: 1, completedAt: 1 });
taskSchema.index({ assignedTo: 1, createdAt: -1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ assignedBy: 1, "extensionRequests.status": 1 });
taskSchema.index({ deadline: 1, status: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ department: 1, status: 1 });
taskSchema.index({ status: 1, deadline: 1 });
taskSchema.index({ completedAt: -1 });
// New indexes for recurring task generation
taskSchema.index({ templateId: 1, occurrenceDate: -1 });
taskSchema.index({ isGeneratedOccurrence: 1, occurrenceDate: -1 });
taskSchema.index({ generatedByCron: 1, generatedAt: -1 });
taskSchema.index({ assignmentEmailStatus: 1, assignmentEmailRetryCount: 1 });
// Indexes for master task operational queries
taskSchema.index({ templateId: 1, isGeneratedOccurrence: 1, status: 1 });
taskSchema.index({ templateId: 1, isGeneratedOccurrence: 1, occurrenceDate: -1 });

export default mongoose.models?.Task || mongoose.model("Task", taskSchema);
