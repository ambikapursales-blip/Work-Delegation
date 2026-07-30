import mongoose from "mongoose";

const recurringTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Template title is required"],
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
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Template must be assigned to at least one user"],
      },
    ],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Template must have an assigner"],
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
      required: [true, "Task type is required"],
      default: "One Time",
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
      daysOfWeek: [
        {
          type: Number,
        },
      ],
      dayOfMonth: {
        type: Number,
      },
      customDays: [Number],
    },
    status: {
      type: String,
      enum: ["Active", "Paused", "Deleted", "Scheduled", "Generated"],
      default: "Active",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    pausedAt: {
      type: Date,
    },
    pausedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
    },
    nextGenerationDate: {
      type: Date,
      required: [
        function () { return this.taskType !== "One Time"; },
        "Next generation date is required for recurring templates",
      ],
    },
    lastGeneratedDate: {
      type: Date,
    },
    generatedCount: {
      type: Number,
      default: 0,
    },
    defaultDeadlineHours: {
      type: Number,
    },
    deadline: {
      type: Date,
      validate: {
        validator: function (v) {
          // Required only for One Time templates
          if (this.taskType === "One Time") return v != null;
          return true;
        },
        message: "Deadline is required for one-time master tasks",
      },
    },
    repeatForever: {
      type: Boolean,
      default: false,
    },
    scheduledHour: {
      type: Number,
      default: 9,
      min: 0,
      max: 23,
    },
    scheduledMinute: {
      type: Number,
      default: 0,
      min: 0,
      max: 59,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
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
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
recurringTemplateSchema.index({ assignedBy: 1, isActive: 1 });
recurringTemplateSchema.index({ nextGenerationDate: 1, isActive: 1 });
recurringTemplateSchema.index({ assignedTo: 1, isActive: 1 });
recurringTemplateSchema.index({ taskType: 1, isActive: 1 });
recurringTemplateSchema.index({ createdAt: -1 });
recurringTemplateSchema.index({ status: 1, createdAt: -1 });
recurringTemplateSchema.index({ status: 1, taskType: 1, createdAt: -1 });

// Virtual for checking if template should generate
recurringTemplateSchema.virtual("shouldGenerate").get(function () {
  if (!this.isActive) return false;
  if (!this.repeatForever && this.endDate && new Date() > this.endDate) return false;
  if (!this.nextGenerationDate) return false;
  return new Date() >= this.nextGenerationDate;
});

// Pre-save hook to validate recurrence pattern for recurring types
recurringTemplateSchema.pre("save", function (next) {
  if (this.taskType !== "One Time" && !this.recurrencePattern) {
    return next(new Error("Recurrence pattern is required for recurring task types"));
  }
  // Sync isActive with status field
  if (this.status === "Active" || this.status === "Scheduled") {
    this.isActive = true;
  } else if (this.status === "Paused" || this.status === "Deleted" || this.status === "Generated") {
    this.isActive = false;
  }
  next();
});

export default mongoose.models?.RecurringTemplate || mongoose.model("RecurringTemplate", recurringTemplateSchema);
