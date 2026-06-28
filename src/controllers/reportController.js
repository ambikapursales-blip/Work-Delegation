import Task from "../models/Task.js";
import User from "../models/User.js";
import DWR from "../models/DWR.js";
import Activity from "../models/Activity.js";
import Attendance from "../models/Attendance.js";

export const getTaskReport = async (req, res) => {
  try {
    const { startDate, endDate, department, status } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (department) matchQuery.department = department;
    if (status) matchQuery.status = status;

    if (["Sales Executive", "Coordinator"].includes(req.user.role)) {
      matchQuery.assignedTo = { $in: [req.user._id] };
    } else if (req.user.role === "Manager") {
      const teamMembers = await User.find({ managerId: req.user._id }).select(
        "_id",
      );
      const teamIds = teamMembers.map((m) => m._id);
      matchQuery.assignedTo = { $in: teamIds };
    }

    const tasks = await Task.find(matchQuery).lean().select("status priority department deadline createdAt");

    const byStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    const byPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    const byDepartment = tasks.reduce((acc, task) => {
      const dept = task.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const overdueTasks = tasks.filter(
      (task) =>
        task.deadline < new Date() &&
        task.status !== "Completed" &&
        task.status !== "Cancelled",
    ).length;

    res.status(200).json({
      success: true,
      report: {
        total: tasks.length,
        byStatus,
        byPriority,
        byDepartment,
        overdueTasks,
        chartData: {
          status: Object.keys(byStatus).map((key) => ({
            label: key,
            value: byStatus[key],
          })),
          priority: Object.keys(byPriority).map((key) => ({
            label: key,
            value: byPriority[key],
          })),
          department: Object.keys(byDepartment).map((key) => ({
            label: key,
            value: byDepartment[key],
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDWRReport = async (req, res) => {
  try {
    const { startDate, endDate, reviewStatus } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }
    if (reviewStatus) matchQuery.reviewStatus = reviewStatus;

    if (["Sales Executive", "Coordinator"].includes(req.user.role)) {
      matchQuery.employee = req.user._id;
    } else if (req.user.role === "Manager") {
      const teamMembers = await User.find({ managerId: req.user._id }).select(
        "_id",
      );
      const teamIds = teamMembers.map((m) => m._id);
      matchQuery.employee = { $in: teamIds };
    }

    const dwrs = await DWR.find(matchQuery).lean().select("reviewStatus isLate totalHoursWorked employee").populate("employee", "name department");

    const byStatus = dwrs.reduce((acc, dwr) => {
      acc[dwr.reviewStatus] = (acc[dwr.reviewStatus] || 0) + 1;
      return acc;
    }, {});

    const byDepartment = dwrs.reduce((acc, dwr) => {
      const dept = dwr.employee?.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const lateSubmissions = dwrs.filter((dwr) => dwr.isLate).length;

    const avgHours =
      dwrs.length > 0
        ? dwrs.reduce((sum, dwr) => sum + (dwr.totalHoursWorked || 0), 0) /
          dwrs.length
        : 0;

    res.status(200).json({
      success: true,
      report: {
        total: dwrs.length,
        byStatus,
        byDepartment,
        lateSubmissions,
        avgHours: Math.round(avgHours * 10) / 10,
        chartData: {
          status: Object.keys(byStatus).map((key) => ({
            label: key,
            value: byStatus[key],
          })),
          department: Object.keys(byDepartment).map((key) => ({
            label: key,
            value: byDepartment[key],
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate);
      if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    const attendances = await Attendance.find(matchQuery).lean().select("status user").populate(
      "user",
      "name department",
    );

    const byStatus = attendances.reduce((acc, att) => {
      acc[att.status] = (acc[att.status] || 0) + 1;
      return acc;
    }, {});

    const byDepartment = attendances.reduce((acc, att) => {
      const dept = att.user?.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const presentPercentage =
      attendances.length > 0
        ? ((byStatus.Present || 0) / attendances.length) * 100
        : 0;

    res.status(200).json({
      success: true,
      report: {
        total: attendances.length,
        byStatus,
        byDepartment,
        presentPercentage: Math.round(presentPercentage),
        chartData: {
          status: Object.keys(byStatus).map((key) => ({
            label: key,
            value: byStatus[key],
          })),
          department: Object.keys(byDepartment).map((key) => ({
            label: key,
            value: byDepartment[key],
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPerformanceReport = async (req, res) => {
  try {
    const { period = "month", department } = req.query;

    let matchQuery = { isActive: true };
    if (department) matchQuery.department = department;

    if (req.user.role === "Manager") {
      const teamMembers = await User.find({ managerId: req.user._id }).select(
        "_id",
      );
      const teamIds = teamMembers.map((m) => m._id);
      matchQuery._id = { $in: teamIds };
    }

    const users = await User.find(matchQuery).lean().select("_id name department performanceScore grade");

    const now = new Date();
    let startDate;
    if (period === "week") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === "month") {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const performanceData = await Promise.all(
      users.map(async (user) => {
        const userId = user._id;

        const totalTasks = await Task.countDocuments({
          assignedTo: { $in: [userId] },
          createdAt: { $gte: startDate },
        });
        const completedTasks = await Task.countDocuments({
          assignedTo: { $in: [userId] },
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

        return {
          user: user.name,
          department: user.department,
          performanceScore: user.performanceScore || 0,
          grade: user.grade,
          taskCompletionRate:
            totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
          dwrApprovalRate:
            totalDWRs > 0 ? (approvedDWRs / totalDWRs) * 100 : 0,
        };
      }),
    );

    const avgPerformanceScore =
      performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + p.performanceScore, 0) /
          performanceData.length
        : 0;

    const avgTaskCompletion =
      performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + p.taskCompletionRate, 0) /
          performanceData.length
        : 0;

    const gradeDistribution = performanceData.reduce((acc, p) => {
      const grade = p.grade || "N/A";
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    const sortedByScore = [...performanceData].sort(
      (a, b) => b.performanceScore - a.performanceScore,
    );
    const topPerformers = sortedByScore.slice(
      0,
      Math.max(1, Math.ceil(performanceData.length * 0.1)),
    );

    const lowPerformers = sortedByScore
      .slice(-Math.max(1, Math.ceil(performanceData.length * 0.1)))
      .reverse();

    res.status(200).json({
      success: true,
      report: {
        period,
        totalUsers: performanceData.length,
        avgPerformanceScore: Math.round(avgPerformanceScore),
        avgTaskCompletion: Math.round(avgTaskCompletion),
        gradeDistribution,
        topPerformers,
        lowPerformers,
        chartData: {
          grades: Object.keys(gradeDistribution).map((key) => ({
            label: key,
            value: gradeDistribution[key],
          })),
          performance: performanceData.map((p) => ({
            label: p.user,
            value: p.performanceScore,
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActivityReport = async (req, res) => {
  try {
    const { startDate, endDate, type, userId } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (type) matchQuery.type = type;
    if (userId) matchQuery.user = userId;

    if (["Sales Executive", "Coordinator"].includes(req.user.role)) {
      matchQuery.user = req.user._id;
    } else if (req.user.role === "Manager") {
      const teamMembers = await User.find({ managerId: req.user._id }).select(
        "_id",
      );
      const teamIds = teamMembers.map((m) => m._id);
      matchQuery.user = { $in: teamIds };
    }

    const activities = await Activity.find(matchQuery).lean().select("type createdAt user")
      .populate("user", "name")
      .sort({ createdAt: -1 });

    const byType = activities.reduce((acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {});

    const byDate = {};
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    activities.forEach((activity) => {
      if (activity.createdAt >= sevenDaysAgo) {
        const dateKey = activity.createdAt.toISOString().split("T")[0];
        byDate[dateKey] = (byDate[dateKey] || 0) + 1;
      }
    });

    res.status(200).json({
      success: true,
      report: {
        total: activities.length,
        byType,
        byDate,
        chartData: {
          type: Object.keys(byType).map((key) => ({
            label: key,
            value: byType[key],
          })),
          timeline: Object.keys(byDate)
            .sort()
            .map((key) => ({
              label: key,
              value: byDate[key],
            })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardAnalytics = async (req, res) => {
  try {
    const { period = "month", userId, status } = req.query;

    const now = new Date();
    let startDate;
    if (period === "week") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === "month") {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else if (period === "quarter") {
      startDate = new Date(now.setMonth(now.getMonth() - 3));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    let userQuery = { isActive: true };
    if (userId) {
      userQuery._id = userId;
    } else if (req.user.role === "Manager") {
      const teamMembers = await User.find({ managerId: req.user._id }).select(
        "_id",
      );
      const teamIds = teamMembers.map((m) => m._id);
      userQuery._id = { $in: teamIds };
    } else if (["Sales Executive", "Coordinator"].includes(req.user.role)) {
      userQuery._id = req.user._id;
    }

    const users = await User.find(userQuery).lean().select("_id lastActive");
    const userIds = users.map((u) => u._id);

    let taskMatch = {
      assignedTo: { $in: userIds },
      createdAt: { $gte: startDate },
    };

    if (status) {
      if (status === "completed") {
        taskMatch.status = "Completed";
      } else if (status === "inprogress") {
        taskMatch.status = "In Progress";
      } else if (status === "pending") {
        taskMatch.status = "Pending";
      } else if (status === "overdue") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        taskMatch.deadline = { $lt: today };
        taskMatch.status = { $ne: "Completed" };
      }
    }

    const taskStats = await Task.aggregate([
      { $match: taskMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
          },
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
      {
        $match: {
          employee: { $in: userIds },
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$reviewStatus", "Approved"] }, 1, 0] },
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ["$reviewStatus", "Pending Review"] }, 1, 0],
            },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$reviewStatus", "Rejected"] }, 1, 0] },
          },
          late: { $sum: { $cond: ["$isLate", 1, 0] } },
        },
      },
    ]);

    const taskTrend = [];
    const trendInterval = period === "week" ? 1 : 7;
    const trendStart = new Date(startDate);

    for (let i = 0; i < (period === "week" ? 7 : 4); i++) {
      const intervalStart = new Date(trendStart);
      intervalStart.setDate(intervalStart.getDate() + i * trendInterval);
      const intervalEnd = new Date(intervalStart);
      intervalEnd.setDate(intervalEnd.getDate() + trendInterval);

      const completed = await Task.countDocuments({
        assignedTo: { $in: userIds },
        status: "Completed",
        completedAt: { $gte: intervalStart, $lt: intervalEnd },
      });

      const created = await Task.countDocuments({
        assignedTo: { $in: userIds },
        createdAt: { $gte: intervalStart, $lt: intervalEnd },
      });

      taskTrend.push({
        date: intervalStart.toISOString().split("T")[0],
        completed,
        created,
      });
    }

    const deptStats = await Task.aggregate([
      { $match: taskMatch },
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
    ]);

    const taskData = taskStats[0] || {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      overdue: 0,
    };
    const dwrData = dwrStats[0] || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      late: 0,
    };

    res.status(200).json({
      success: true,
      analytics: {
        period,
        users: {
          total: users.length,
          active: users.filter(
            (u) =>
              u.lastActive &&
              u.lastActive >= new Date(Date.now() - 24 * 60 * 60 * 1000),
          ).length,
        },
        tasks: taskData,
        dwr: dwrData,
        trends: {
          taskCompletion: taskTrend,
        },
        departments: deptStats.map((d) => ({
          label: d._id || "Unassigned",
          value: d.count,
        })),
        chartData: {
          taskStatus: [
            { label: "Completed", value: taskData.completed },
            { label: "Pending", value: taskData.pending },
            { label: "In Progress", value: taskData.inProgress },
          ],
          dwrStatus: [
            { label: "Approved", value: dwrData.approved },
            { label: "Pending", value: dwrData.pending },
            { label: "Rejected", value: dwrData.rejected },
          ],
          taskTrend: taskTrend.map((t) => ({
            date: t.date,
            completed: t.completed,
            created: t.created,
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
