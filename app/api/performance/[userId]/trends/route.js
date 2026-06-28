import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import User from "@/src/models/User";
import Task from "@/src/models/Task";
import DWR from "@/src/models/DWR";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  if (!["Admin", "Manager", "HR"].includes(user.role)) {
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

    if (user.role === "Manager") {
      const teamMembers = await User.find({ managerId: user._id }).select("_id");
      const teamIds = teamMembers.map((m) => m._id);
      if (!teamIds.some((id) => id.toString() === userId)) {
        res.status(403).json({ success: false, message: "Not authorized" });
        return finishRes(res);
      }
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

    const trends = [];
    let currentDate = new Date(startDate);

    while (currentDate <= now) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + intervalDays);

      const tasksCompleted = await Task.countDocuments({
        assignedTo: { $in: [userId] },
        status: "Completed",
        createdAt: { $gte: currentDate, $lt: nextDate },
      });

      const dwrSubmitted = await DWR.countDocuments({
        employee: userId,
        date: { $gte: currentDate, $lt: nextDate },
      });

      trends.push({
        date: currentDate.toISOString().split("T")[0],
        tasksCompleted,
        dwrSubmitted,
      });

      currentDate = nextDate;
    }

    res.status(200).json({ success: true, trends, period });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  return finishRes(res);
}
