import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "login",
        "logout",
        "task_created",
        "task_updated",
        "task_completed",
        "task_assigned",
        "dwr_submitted",
        "event_created",
        "event_assigned",
        "event_rsvp",
        "user_created",
        "user_updated",
        "performance_updated",
        "report_generated",
        "attendance_marked",
        "password_changed",
        "profile_updated",
      ],
      required: true,
    },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityType: {
      type: String,
      enum: ["Task", "DWR", "Event", "User", "Attendance", "Performance"],
    },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true },
);

activitySchema.index({ user: 1, createdAt: -1 });
export default mongoose.models.Activity || mongoose.model("Activity", activitySchema);
