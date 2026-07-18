import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: [
        "task_assigned",
        "task_updated",
        "task_completed",
        "event_assigned",
        "event_started",
        "dwr_reminder",
        "performance_review",
        "leave_approved",
        "leave_rejected",
        "general",
        "announcement",
        "message_sent",
        "comment_added",
        "status_changed",
        "deadline_extended",
        "file_uploaded",
      ],
      default: "general",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    entityType: {
      type: String,
      enum: ["Task", "Event", "DWR", "User", "Leave", "Conversation", "Message", ""],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    actionUrl: String,
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, type: 1, createdAt: -1 });
notificationSchema.index({ entityId: 1, entityType: 1 });
export default mongoose.models?.Notification || mongoose.model("Notification", notificationSchema);
