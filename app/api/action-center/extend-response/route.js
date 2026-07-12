import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
  parseBody,
} from "@/src/lib/route-adapter";
import { processExtensionResponse } from "@/src/utils/extensionActions";
import Task from "@/src/models/Task";

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  await parseBody(request);
  const req = createReq(request);
  req.user = user;
  const res = createRes();

  try {
    const data = req.body || {};
    const { taskId, requestId, action } = data;

    if (!taskId || !requestId || !action) {
      res.status(400).json({ success: false, message: "Missing required fields" });
      return finishRes(res);
    }

    if (action !== "approved" && action !== "rejected") {
      res.status(400).json({ success: false, message: "Invalid action" });
      return finishRes(res);
    }

    const task = await Task.findById(taskId).select("assignedBy").lean();
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return finishRes(res);
    }
    if (task.assignedBy.toString() !== user._id.toString()) {
      res.status(403).json({ success: false, message: "You are not authorized to respond to this request" });
      return finishRes(res);
    }

    const result = await processExtensionResponse(taskId, requestId, action);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("[ActionCenter ExtendResponse] Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
