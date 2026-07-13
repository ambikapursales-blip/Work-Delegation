import mongoose from "mongoose";

const dwrSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedTasks: [
      {
        task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
        description: String,
        hoursSpent: Number,
      },
    ],
    pendingTasks: [
      {
        task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
        reason: String,
        estimatedCompletion: Date,
      },
    ],
    remarks: {
      type: String,
      trim: true,
      maxlength: [2000, "Remarks cannot exceed 2000 characters"],
    },
    workSummary: {
      type: String,
      trim: true,
    },
    challenges: {
      type: String,
      trim: true,
    },
    nextDayPlan: {
      type: String,
      trim: true,
    },
    totalHoursWorked: {
      type: Number,
      min: 0,
      max: 24,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNote: {
      type: String,
    },
    reviewStatus: {
      type: String,
      enum: ["Pending Review", "Approved", "Rejected"],
      default: "Pending Review",
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
  },
  {
    timestamps: true,
  },
);

dwrSchema.index({ employee: 1, date: 1 }, { unique: true });
dwrSchema.index({ reviewStatus: 1 });
dwrSchema.index({ employee: 1, reviewStatus: 1, date: 1 });
dwrSchema.index({ date: -1 });

dwrSchema.pre("save", function (next) {
  if (this.isNew) {
    const hour = new Date().getHours();
    this.isLate = hour >= 20;
  }
  next();
});

export default mongoose.models.DWR || mongoose.model("DWR", dwrSchema);
