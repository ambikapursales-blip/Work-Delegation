import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import User from "@/src/models/User";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const authUser = await requireAuth(request); if (authUser instanceof NextResponse) return authUser;
  const req = createReq(request, params);
  req.user = authUser;
  const res = createRes();
  try {
    const userId = req.params.userId || authUser._id;

    // Authorization check
    const isOwn = userId.toString() === authUser._id.toString();
    const canQueryOtherUsers = authUser.role === "Super Admin" || authUser.canViewAllTasks;
    let isManagerOfUser = false;
    if (authUser.role === "Manager" && !isOwn) {
      const teamMember = await User.findOne({
        _id: userId,
        managerId: authUser._id,
      })
        .select("_id")
        .lean();
      isManagerOfUser = !!teamMember;
    }
    if (!isOwn && !canQueryOtherUsers && !isManagerOfUser) {
      return NextResponse.json(
        { success: false, message: "Not authorized" },
        { status: 403 },
      );
    }

    const tasksCompleted = await Task.countDocuments({
      assignedTo: userId,
      status: "Completed",
    });
    const tasksPending = 0;
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
