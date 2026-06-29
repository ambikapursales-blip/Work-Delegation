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
  if (!["Admin", "Manager", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { period = "month", department, limit = 20 } = req.query;

    let query = { isActive: true };
    if (department) query.department = department;

    if (user.role === "Manager") {
      const teamMembers = await User.find({ managerId: user._id }).select("_id");
      const teamIds = teamMembers.map((m) => m._id);
      query._id = { $in: teamIds };
    }

    const now = new Date();
    let startDate;
    if (period === "week") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === "month") {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const users = await User.find(query)
      .select("name email role department performanceScore grade employeeId avatar")
      .sort({ performanceScore: -1 })
      .limit(parseInt(limit));

    const leaderboard = await Promise.all(
      users.map(async (u) => {
        const userId = u._id;

        const totalTasks = await Task.countDocuments({
          assignedTo: userId,
          createdAt: { $gte: startDate },
        });
        const completedTasks = await Task.countDocuments({
          assignedTo: userId,
          status: "Completed",
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

        const overdueTasks = await Task.countDocuments({
          assignedTo: userId,
          deadline: { $lt: new Date() },
          status: { $nin: ["Completed", "Cancelled"] },
        });

        return {
          user: u.toObject(),
          metrics: {
            taskCompletionRate:
              totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
            dwrApprovalRate:
              totalDWRs > 0 ? (approvedDWRs / totalDWRs) * 100 : 0,
            totalTasks,
            completedTasks,
            totalDWRs,
            approvedDWRs,
            overdueTasks,
          },
        };
      }),
    );

    leaderboard.sort((a, b) => {
      const scoreA =
        a.metrics.taskCompletionRate * 0.4 +
        a.metrics.dwrApprovalRate * 0.3 +
        (a.user?.performanceScore || 0) * 0.3;
      const scoreB =
        b.metrics.taskCompletionRate * 0.4 +
        b.metrics.dwrApprovalRate * 0.3 +
        (b.user?.performanceScore || 0) * 0.3;
      return scoreB - scoreA;
    });

    res.status(200).json({ success: true, leaderboard, period });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  return finishRes(res);
}
