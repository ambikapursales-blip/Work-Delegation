import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Message from "@/src/models/Message";
import Task from "@/src/models/Task";
import Conversation from "@/src/models/Conversation";
import User from "@/src/models/User";
import { getTaskScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;

  try {
    const taskScope = await getTaskScopeFilter(user);
    const userTasks = await Task.find(taskScope).select("_id").lean();

    const taskIds = userTasks.map((t) => t._id);

    if (taskIds.length === 0) {
      return finishRes(res.status(200).json({ success: true, totalUnread: 0 }));
    }

    const conversations = await Conversation.find({ taskId: { $in: taskIds } })
      .select("taskId participants")
      .lean();

    let totalUnread = 0;
    for (const conv of conversations) {
      const participant = conv.participants?.find(
        (p) => p.userId && p.userId.toString() === user._id.toString(),
      );
      const lastReadAt = participant?.lastReadAt || null;
      const match = {
        taskId: conv.taskId,
        sender: { $ne: user._id },
        isDeleted: { $ne: true },
      };
      if (lastReadAt) {
        match.createdAt = { $gt: new Date(lastReadAt) };
      }
      totalUnread += await Message.countDocuments(match);
    }

    return finishRes(res.status(200).json({ success: true, totalUnread }));
  } catch (error) {
    return finishRes(
      res.status(500).json({ success: false, message: "Server error" }),
    );
  }
}
