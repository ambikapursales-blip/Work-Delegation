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

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (user.role !== "Super Admin" && !user.canViewAllTasks && params.userId !== user._id.toString()) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const { userId } = req.params;
    const { period = "month" } = req.query;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return finishRes(res);
    }

    const now = new Date();
    let startDate;
    let intervalDays;

    if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      intervalDays = 1;
    } else if (period === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      intervalDays = 7;
    } else {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      intervalDays = 30;
    }

    const [taskBuckets, dwrBuckets] = await Promise.all([
      Task.aggregate([
        {
          $match: {
            assignedTo: { $in: [userId] },
            status: "Completed",
            createdAt: { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      DWR.aggregate([
        {
          $match: {
            employee: userId,
            date: { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date",
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const taskMap = new Map(taskBuckets.map((b) => [b._id, b.count]));
    const dwrMap = new Map(dwrBuckets.map((b) => [b._id, b.count]));

    const trends = [];
    let currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split("T")[0];

      let intervalEnd = new Date(currentDate);
      intervalEnd.setDate(intervalEnd.getDate() + intervalDays);

      let tasksCompleted = 0;
      let dwrSubmitted = 0;

      let cursor = new Date(currentDate);
      while (cursor < intervalEnd && cursor <= now) {
        const key = cursor.toISOString().split("T")[0];
        tasksCompleted += taskMap.get(key) || 0;
        dwrSubmitted += dwrMap.get(key) || 0;
        cursor.setDate(cursor.getDate() + 1);
      }

      trends.push({ date: dateKey, tasksCompleted, dwrSubmitted });
      currentDate = intervalEnd;
    }

    res.status(200).json({ success: true, trends, period });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  return finishRes(res);
}
