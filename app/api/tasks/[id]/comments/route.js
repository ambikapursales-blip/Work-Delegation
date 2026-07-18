import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { addComment } from "@/src/controllers/taskController";
import Task from "@/src/models/Task";

export async function POST(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return finishRes(res);
    }

    const isAssignee = task.assignedTo?.some((id) => id.toString() === user._id.toString());
    const isAssigner = task.assignedBy?.toString() === user._id.toString();
    if (!isAssignee && !isAssigner && user.role !== "Super Admin" && !user.canViewAllTasks) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return finishRes(res);
    }

    await addComment(req, res);
    return finishRes(res);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
    return finishRes(res);
  }
}
