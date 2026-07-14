import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      maxlength: 5000,
      default: "",
    },
    type: {
      type: String,
      enum: [
        "text",
        "system",
        "status_change",
        "deadline_extend",
        "file_upload",
        "task_completed",
        "task_assigned",
        "extension_requested",
        "extension_approved",
        "extension_rejected",
        "task_reopened",
        "task_accepted",
        "task_rejected",
        "priority_changed",
        "assignee_changed",
      ],
      default: "text",
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        mimeType: String,
      },
    ],
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ taskId: 1, createdAt: -1 });
messageSchema.index({ taskId: 1, createdAt: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ parentId: 1 });
messageSchema.index({ "mentions": 1 });
messageSchema.index({ isDeleted: 1, taskId: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model("Message", messageSchema);
