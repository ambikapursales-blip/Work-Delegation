import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Conversation from "@/src/models/Conversation";
import Notification from "@/src/models/Notification";
import Task from "@/src/models/Task";
import { canAccessConversation } from "@/src/utils/conversationAuth";

export async function PUT(request, { params }) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;

  try {
    const task = await Task.findById(req.params.taskId)
      .select("title assignedTo assignedBy")
      .lean();

    if (!task) {
      return finishRes(res.status(404).json({ success: false, message: "Task not found" }));
    }

    const authorized = await canAccessConversation(user, task);
    if (!authorized) {
      return finishRes(res.status(403).json({ success: false, message: "Not authorized" }));
    }

    let conversation = await Conversation.findOne({ taskId: task._id });

    if (!conversation) {
      const { getConversationParticipants } = await import("@/src/utils/conversationAuth");
      const participants = getConversationParticipants(task);
      conversation = await Conversation.create({
        taskId: task._id,
        participants,
      });
    }

    const existingIdx = conversation.participants.findIndex(
      (p) => p.userId && p.userId.toString() === user._id.toString(),
    );

    if (existingIdx >= 0) {
      conversation.participants[existingIdx].lastReadAt = new Date();
    } else {
      conversation.participants.push({
        userId: user._id,
        role: user.role,
        lastReadAt: new Date(),
      });
    }

    await conversation.save();

    // Sync: mark matching notifications as read
    try {
      await Notification.updateMany(
        {
          recipient: user._id,
          entityId: task._id,
          entityType: "Task",
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        },
      );
    } catch (notifErr) {
      console.error("Failed to sync notification read state:", notifErr);
    }

    return finishRes(res.status(200).json({ success: true, message: "Marked as read" }));
  } catch (error) {
    return finishRes(res.status(500).json({ success: false, message: "Server error" }));
  }
}
