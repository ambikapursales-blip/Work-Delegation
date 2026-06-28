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
      enum: ["Pending", "In Progress", "Completed", "Cancelled", "On Hold"],
      default: "Pending",
    },
    deadline: {
      type: Date,
      required: [true, "Deadline is required"],
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
      enum: ["One-time", "Daily", "Weekly", "Monthly", "Custom"],
      default: "One-time",
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
        enum: ["daily", "weekly", "biweekly", "monthly", "custom"],
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

taskSchema.pre("save", function (next) {
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

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1, deadline: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ deadline: 1 });
taskSchema.index({ createdAt: -1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);
