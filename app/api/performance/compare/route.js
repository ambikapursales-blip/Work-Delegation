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
  if (user.role !== "Super Admin" && !user.canViewAllTasks) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { userIds, period = "month", startDate: queryStartDate, endDate: queryEndDate } = req.query;

    if (!userIds) {
      res.status(400).json({
        success: false,
        message: "userIds query parameter is required",
      });
      return finishRes(res);
    }

    const ids = Array.isArray(userIds) ? userIds : userIds.split(",");

    let startDate, endDate;
    if (queryStartDate && queryEndDate) {
      startDate = new Date(queryStartDate);
      endDate = new Date(queryEndDate);
    } else {
      const now = new Date();
      switch (period) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case "yesterday":
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
          endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "last7days":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "last30days":
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case "thismonth":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "thisyear":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }
    }

    const objectIds = ids.filter(Boolean);
    if (objectIds.length === 0) {
      return res.status(200).json({ success: true, comparisons: [], period });
    }

    const taskDateFilter = { $gte: startDate };
    if (endDate) taskDateFilter.$lte = endDate;

    const [users, taskAgg, dwrAgg, timeAgg] = await Promise.all([
      User.find({ _id: { $in: objectIds } })
        .select("name email role department performanceScore grade employeeId avatar")
        .lean(),
      Task.aggregate([
        {
          $match: {
            assignedTo: { $in: objectIds },
            createdAt: taskDateFilter,
            $or: [
              { isRecurring: { $ne: true } },
              { isGeneratedOccurrence: true },
            ],
          },
        },
        { $unwind: "$assignedTo" },
        { $match: { assignedTo: { $in: objectIds } } },
        {
          $group: {
            _id: "$assignedTo",
            totalTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
            inProgressTasks: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
          },
        },
      ]),
      DWR.aggregate([
        { $match: { employee: { $in: objectIds }, date: taskDateFilter } },
        {
          $group: {
            _id: "$employee",
            totalDWRs: { $sum: 1 },
            approvedDWRs: { $sum: { $cond: [{ $eq: ["$reviewStatus", "Approved"] }, 1, 0] } },
          },
        },
      ]),
      Task.aggregate([
        {
          $match: {
            assignedTo: { $in: objectIds },
            status: "Completed",
            completedAt: { $exists: true },
            createdAt: taskDateFilter,
            $or: [
              { isRecurring: { $ne: true } },
              { isGeneratedOccurrence: true },
            ],
          },
        },
        { $unwind: "$assignedTo" },
        { $match: { assignedTo: { $in: objectIds } } },
        {
          $group: {
            _id: "$assignedTo",
            totalHours: { $sum: { $divide: [{ $subtract: ["$completedAt", "$createdAt"] }, 3600000] } },
            taskCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const taskMap = new Map(taskAgg.map((t) => [t._id.toString(), t]));
    const dwrMap = new Map(dwrAgg.map((d) => [d._id.toString(), d]));
    const timeMap = new Map(timeAgg.map((t) => [t._id.toString(), t]));

    const comparisons = objectIds.map((userId) => {
      const u = userMap.get(userId.toString());
      if (!u) return null;

      const t = taskMap.get(userId.toString()) || { totalTasks: 0, completedTasks: 0, inProgressTasks: 0 };
      const d = dwrMap.get(userId.toString()) || { totalDWRs: 0, approvedDWRs: 0 };
      const tm = timeMap.get(userId.toString()) || { totalHours: 0, taskCount: 0 };

      const avgCompletionTime = tm.taskCount > 0 ? tm.totalHours / tm.taskCount : 0;

      return {
        user: u,
        metrics: {
          taskCompletionRate: t.totalTasks > 0 ? (t.completedTasks / t.totalTasks) * 100 : 0,
          dwrApprovalRate: d.totalDWRs > 0 ? (d.approvedDWRs / d.totalDWRs) * 100 : 0,
          totalTasks: t.totalTasks,
          completedTasks: t.completedTasks,
          inProgressTasks: t.inProgressTasks,
          totalDWRs: d.totalDWRs,
          approvedDWRs: d.approvedDWRs,
          avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
        },
      };
    });

    const validComparisons = comparisons.filter((c) => c !== null);

    res.status(200).json({ success: true, comparisons: validComparisons, period });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  return finishRes(res);
}
