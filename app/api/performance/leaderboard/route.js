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
  if (!["Super Admin", "Admin", "Manager", "HR"].includes(user.role)) {
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

    const userIds = users.map((u) => u._id);

    const [taskAgg, dwrAgg] = await Promise.all([
      Task.aggregate([
        { $match: { assignedTo: { $in: userIds }, createdAt: { $gte: startDate } } },
        { $unwind: "$assignedTo" },
        { $match: { assignedTo: { $in: userIds } } },
        {
          $group: {
            _id: "$assignedTo",
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $lt: ["$deadline", new Date()] },
                      { $not: { $in: ["$status", ["Completed", "Cancelled"]] } },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      DWR.aggregate([
        { $match: { employee: { $in: userIds }, date: { $gte: startDate } } },
        {
          $group: {
            _id: "$employee",
            totalDWRs: { $sum: 1 },
            approvedDWRs: {
              $sum: { $cond: [{ $eq: ["$reviewStatus", "Approved"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const taskMap = new Map(taskAgg.map((t) => [t._id.toString(), t]));
    const dwrMap = new Map(dwrAgg.map((d) => [d._id.toString(), d]));

    const leaderboard = users.map((u) => {
      const uid = u._id.toString();
      const t = taskMap.get(uid) || { totalTasks: 0, completedTasks: 0, overdueTasks: 0 };
      const d = dwrMap.get(uid) || { totalDWRs: 0, approvedDWRs: 0 };

      return {
        user: u.toObject(),
        metrics: {
          taskCompletionRate:
            t.totalTasks > 0 ? (t.completedTasks / t.totalTasks) * 100 : 0,
          dwrApprovalRate:
            d.totalDWRs > 0 ? (d.approvedDWRs / d.totalDWRs) * 100 : 0,
          totalTasks: t.totalTasks,
          completedTasks: t.completedTasks,
          totalDWRs: d.totalDWRs,
          approvedDWRs: d.approvedDWRs,
          overdueTasks: t.overdueTasks,
        },
      };
    });

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
