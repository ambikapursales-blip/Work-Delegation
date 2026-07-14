import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      unique: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
        },
        lastReadAt: {
          type: Date,
          default: null,
        },
      },
    ],
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ lastActivityAt: -1 });
conversationSchema.index({ "participants.userId": 1, lastActivityAt: -1 });
conversationSchema.index({ "participants.userId": 1, taskId: 1 });

export default mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
