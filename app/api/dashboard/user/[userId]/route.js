import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import Task from "@/src/models/Task";
import User from "@/src/models/User";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const userId = req.params.userId || user._id;

    const tasksCompleted = await Task.countDocuments({
      assignedTo: userId,
      status: "Completed",
    });
    const tasksPending = await Task.countDocuments({
      assignedTo: userId,
      status: "Pending",
    });
    const tasksInProgress = await Task.countDocuments({
      assignedTo: userId,
      status: "In Progress",
    });

    const foundUser = await User.findById(userId).select(
      "performanceScore grade name email",
    );

    res.status(200).json({
      success: true,
      userStats: {
        user: foundUser,
        tasksCompleted,
        tasksPending,
        tasksInProgress,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
