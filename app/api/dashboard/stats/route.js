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

export async function GET(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { userId, status, period } = req.query;
    let taskStats = {};
    let userStats = {};

    let taskQuery = {};
    let dateFilter = {};

    if (userId) {
      taskQuery.assignedTo = userId;
    } else if (
      user.role !== "Admin" &&
      user.role !== "Manager" &&
      user.role !== "HR"
    ) {
      taskQuery.assignedTo = user._id;
    }

    if (status) {
      if (status === "completed") {
        taskQuery.status = "Completed";
      } else if (status === "inprogress") {
        taskQuery.status = "In Progress";
      } else if (status === "pending") {
        taskQuery.status = "Pending";
      } else if (status === "overdue") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        taskQuery.deadline = { $lt: today };
        taskQuery.status = { $ne: "Completed" };
      }
    }

    if (period) {
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

    const allTasksQuery = { ...taskQuery };
    delete allTasksQuery.status;

    taskStats.total = await Task.countDocuments(
      taskQuery.status ? taskQuery : allTasksQuery,
    );
    taskStats.pending = await Task.countDocuments({
      ...taskQuery,
      status: "Pending",
    });
    taskStats.inProgress = await Task.countDocuments({
      ...taskQuery,
      status: "In Progress",
    });
    taskStats.completed = await Task.countDocuments({
      ...taskQuery,
      status: "Completed",
    });

    if (
      user.role === "Admin" ||
      user.role === "Manager" ||
      user.role === "HR"
    ) {
      userStats.total = await User.countDocuments({ role: { $ne: "Admin" } });
      userStats.active = await User.countDocuments({
        isActive: true,
        role: { $ne: "Admin" },
      });
      userStats.inactive = await User.countDocuments({
        isActive: false,
        role: { $ne: "Admin" },
      });
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
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
