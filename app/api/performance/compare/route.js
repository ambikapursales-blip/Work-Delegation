import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";
import Task from "@/src/models/Task";
import DWR from "@/src/models/DWR";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Super Admin", "Manager", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { userIds, period = "month" } = req.query;

    if (!userIds) {
      res.status(400).json({
        success: false,
        message: "userIds query parameter is required",
      });
      return finishRes(res);
    }

    const ids = Array.isArray(userIds) ? userIds : userIds.split(",");

    const now = new Date();
    let startDate;
    if (period === "week") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === "month") {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const comparisons = await Promise.all(
      ids.map(async (userId) => {
        const u = await User.findById(userId).select(
          "name email role department performanceScore grade employeeId avatar",
        );

        if (!u) return null;

        const totalTasks = await Task.countDocuments({
          assignedTo: userId,
          createdAt: { $gte: startDate },
        });
        const completedTasks = await Task.countDocuments({
          assignedTo: userId,
          status: "Completed",
          createdAt: { $gte: startDate },
        });
        const inProgressTasks = await Task.countDocuments({
          assignedTo: userId,
          status: "In Progress",
          createdAt: { $gte: startDate },
        });

        const totalDWRs = await DWR.countDocuments({
          employee: userId,
          date: { $gte: startDate },
        });
        const approvedDWRs = await DWR.countDocuments({
          employee: userId,
          reviewStatus: "Approved",
          date: { $gte: startDate },
        });

        const tasksWithTime = await Task.find({
          assignedTo: { $in: [userId] },
          status: "Completed",
          completedAt: { $exists: true },
          createdAt: { $gte: startDate },
        }).select("createdAt completedAt");

        const avgCompletionTime =
          tasksWithTime.length > 0
            ? tasksWithTime.reduce((acc, task) => {
                const hours =
                  (task.completedAt - task.createdAt) / (1000 * 60 * 60);
                return acc + hours;
              }, 0) / tasksWithTime.length
            : 0;

        return {
          user: u.toObject(),
          metrics: {
            taskCompletionRate:
              totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
            dwrApprovalRate:
              totalDWRs > 0 ? (approvedDWRs / totalDWRs) * 100 : 0,
            totalTasks,
            completedTasks,
            inProgressTasks,
            totalDWRs,
            approvedDWRs,
            avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
          },
        };
      }),
    );

    const validComparisons = comparisons.filter((c) => c !== null);

    res.status(200).json({ success: true, comparisons: validComparisons, period });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  return finishRes(res);
}
