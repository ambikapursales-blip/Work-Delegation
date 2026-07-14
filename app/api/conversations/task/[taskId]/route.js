import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Conversation from "@/src/models/Conversation";
import Task from "@/src/models/Task";
import { canAccessConversation } from "@/src/utils/conversationAuth";

export async function GET(request, { params }) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;

  try {
    const task = await Task.findById(req.params.taskId)
      .select("title status assignedTo assignedBy deadline priority")
      .lean();

    if (!task) {
      return finishRes(res.status(404).json({ success: false, message: "Task not found" }));
    }

    const authorized = await canAccessConversation(user, task);
    if (!authorized) {
      return finishRes(res.status(403).json({ success: false, message: "Not authorized to access this conversation" }));
    }

    let conversation = await Conversation.findOne({ taskId: task._id })
      .populate("lastMessage", "text type createdAt sender")
      .lean();

    if (!conversation) {
      conversation = {
        taskId: task._id,
        participants: [],
        messageCount: 0,
        lastActivityAt: task.createdAt,
        lastMessage: null,
      };
    }

    return finishRes(res.status(200).json({
      success: true,
      data: {
        ...conversation,
        task,
      },
    }));
  } catch (error) {
    return finishRes(res.status(500).json({ success: false, message: "Server error" }));
  }
}
