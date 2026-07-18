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
import { getTaskScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { userId, status, period, startDate: startDateStr, endDate: endDateStr } = req.query;
    let taskStats = {};
    let userStats = {};

    let taskQuery = {};

    const canViewAll = user.role === "Super Admin" || user.canViewAllTasks;

    if (userId && canViewAll) {
      taskQuery.assignedTo = userId;
    } else {
      const taskScope = await getTaskScopeFilter(user);
      Object.assign(taskQuery, taskScope);
    }

    if (status) {
      if (status === "completed") {
        taskQuery.status = "Completed";
      } else if (status === "inprogress") {
        taskQuery.status = "In Progress";
      } else if (status === "overdue") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        taskQuery.deadline = { $lt: today };
        taskQuery.status = { $ne: "Completed" };
      }
    }

    if (startDateStr || endDateStr) {
      taskQuery.createdAt = {};
      if (startDateStr) taskQuery.createdAt.$gte = new Date(startDateStr);
      if (endDateStr) taskQuery.createdAt.$lte = new Date(endDateStr);
    } else if (period) {
      const now = new Date();
      let startDate;

      if (period === "week") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (period === "month") {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === "quarter") {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
      } else if (period === "year") {
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
      }

      if (startDate) {
        taskQuery.createdAt = { $gte: startDate };
      }
    }

    const [taskResult, userResult] = await Promise.all([
      Task.aggregate([
        { $match: taskQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            inProgress: {
              $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
            },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
          },
        },
      ]),
      canViewAll ? User.aggregate([
        { $match: { role: { $ne: "Super Admin" } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
            inactive: {
              $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
            },
          },
        },
      ]) : Promise.resolve(null),
    ]);

    const taskCounts = taskResult[0];
    taskStats.total = (taskCounts && taskCounts.total) || 0;
    taskStats.pending = 0;
    taskStats.inProgress = (taskCounts && taskCounts.inProgress) || 0;
    taskStats.completed = (taskCounts && taskCounts.completed) || 0;

    if (canViewAll) {
      const userCounts = userResult[0];
      userStats.total = (userCounts && userCounts.total) || 0;
      userStats.active = (userCounts && userCounts.active) || 0;
      userStats.inactive = (userCounts && userCounts.inactive) || 0;
    } else {
      userStats.total = 1;
      userStats.active = 1;
      userStats.inactive = 0;
    }

    res.status(200).json({
      success: true,
      stats: { tasks: taskStats, users: userStats },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
