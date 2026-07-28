import mongoose from "mongoose";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import DWR from "../models/DWR.js";

export const getTeamMembers = async (req, res) => {
  try {
    let query = { isActive: true };

    const users = await User.find(query).lean()
      .select(
        "name email role department employeeId lastLogin lastActive isActive performanceScore grade",
      )
      .sort({ name: 1 });

    const userIds = users.map((u) => u._id);
    const taskStats = await Task.aggregate([
      {
        $match: {
          assignedTo: { $in: userIds },
          $or: [
            { isRecurring: { $ne: true } },
            { isGeneratedOccurrence: true },
          ],
        },
      },
      { $unwind: "$assignedTo" },
      { $match: { assignedTo: { $in: userIds } } },
      {
        $group: {
          _id: "$assignedTo",
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          pending: { $sum: 0 },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$deadline", new Date()] },
                    { $not: { $in: ["$status", ["Completed", "Cancelled"]] } },
                    {
                      $or: [
                        { $ne: ["$isRecurring", true] },
                        { $eq: ["$isGeneratedOccurrence", true] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const statsMap = new Map(
      taskStats.map((s) => [s._id.toString(), s]),
    );

    const usersWithStats = users.map((user) => {
      const stats = statsMap.get(user._id.toString()) || {
        total: 0, completed: 0, pending: 0, inProgress: 0, overdue: 0,
      };

      return {
        ...user,
        taskStats: stats,
      };
    });

    res.status(200).json({ success: true, members: usersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeTasks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, priority, page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let query = { assignedTo: { $in: [userId] } };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const skip = (page - 1) * limit;
    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query).lean()
      .populate("assignedTo", "name email role avatar")
      .populate("assignedBy", "name email")
      .populate("assigneeProgress.user", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res
      .status(200)
      .json({ success: true, total, count: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const skip = (page - 1) * limit;
    const total = await Activity.countDocuments({ user: userId });
    const activities = await Activity.find({ user: userId }).lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res
      .status(200)
      .json({ success: true, total, count: activities.length, activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeDWRs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let query = { employee: userId };
    if (status) query.reviewStatus = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const total = await DWR.countDocuments(query);
    const dwrs = await DWR.find(query)
      .populate("employee", "name email employeeId")
      .populate("reviewedBy", "name email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({ success: true, total, count: dwrs.length, dwrs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeamStats = async (req, res) => {
  try {
    let matchQuery = { isActive: true };

    const teamMembers = await User.find(matchQuery).select(
      "_id name role department",
    );
    const teamIds = teamMembers.map((m) => m._id);

    const taskStats = await Task.aggregate([
      {
        $match: {
          assignedTo: { $in: teamIds },
          $or: [
            { isRecurring: { $ne: true } },
            { isGeneratedOccurrence: true },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          pendingTasks: { $sum: 0 },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
          },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$deadline", new Date()] },
                    { $not: { $in: ["$status", ["Completed", "Cancelled"]] } },
                    {
                      $or: [
                        { $ne: ["$isRecurring", true] },
                        { $eq: ["$isGeneratedOccurrence", true] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const dwrStats = await DWR.aggregate([
      { $match: { employee: { $in: teamIds } } },
      {
        $group: {
          _id: null,
          totalDWRs: { $sum: 1 },
          approvedDWRs: {
            $sum: { $cond: [{ $eq: ["$reviewStatus", "Approved"] }, 1, 0] },
          },
          pendingDWRs: {
            $sum: {
              $cond: [{ $eq: ["$reviewStatus", "Pending Review"] }, 1, 0],
            },
          },
          rejectedDWRs: {
            $sum: { $cond: [{ $eq: ["$reviewStatus", "Rejected"] }, 1, 0] },
          },
        },
      },
    ]);

    const activeUsers = await User.countDocuments({
      _id: { $in: teamIds },
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const stats = {
      totalMembers: teamMembers.length,
      activeUsers,
      tasks: taskStats[0] || {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
      },
      dwrs: dwrStats[0] || {
        totalDWRs: 0,
        approvedDWRs: 0,
        pendingDWRs: 0,
        rejectedDWRs: 0,
      },
    };

    res.status(200).json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeePerformance = async (req, res) => {
  try {
    const { userId: userIdStr } = req.params;
    const userId = new mongoose.Types.ObjectId(userIdStr);
    const { period = "month", startDate: queryStartDate, endDate: queryEndDate } = req.query;

    const user = await User.findById(userId).lean().select(
      "name email role department performanceScore grade employeeId",
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

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

    const taskDateFilter = { $gte: startDate };
    if (endDate) taskDateFilter.$lte = endDate;

    const [taskCounts] = await Task.aggregate([
      {
        $match: {
          assignedTo: { $in: [userId] },
          createdAt: taskDateFilter,
          $or: [
            { isRecurring: { $ne: true } },
            { isGeneratedOccurrence: true },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
          totalHours: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$status", "Completed"] }, { $ifNull: ["$completedAt", false] }] },
                { $divide: [{ $subtract: ["$completedAt", "$createdAt"] }, 3600000] },
                0,
              ],
            },
          },
          completedWithTime: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$status", "Completed"] }, { $ifNull: ["$completedAt", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const [dwrCounts] = await DWR.aggregate([
      { $match: { employee: userId, date: taskDateFilter } },
      {
        $group: {
          _id: null,
          totalDWRs: { $sum: 1 },
          approvedDWRs: { $sum: { $cond: [{ $eq: ["$reviewStatus", "Approved"] }, 1, 0] } },
        },
      },
    ]);

    const t = taskCounts || { totalTasks: 0, completedTasks: 0, totalHours: 0, completedWithTime: 0 };
    const d = dwrCounts || { totalDWRs: 0, approvedDWRs: 0 };
    const avgCompletionTime = t.completedWithTime > 0 ? t.totalHours / t.completedWithTime : 0;

    const performance = {
      user,
      period,
      taskCompletionRate: t.totalTasks > 0 ? (t.completedTasks / t.totalTasks) * 100 : 0,
      dwrApprovalRate: d.totalDWRs > 0 ? (d.approvedDWRs / d.totalDWRs) * 100 : 0,
      totalTasks: t.totalTasks,
      completedTasks: t.completedTasks,
      totalDWRs: d.totalDWRs,
      approvedDWRs: d.approvedDWRs,
      avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
    };

    res.status(200).json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
