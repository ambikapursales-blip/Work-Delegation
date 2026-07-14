import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Notification from "@/src/models/Notification";
import { getScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (user.role !== "Super Admin" && !user.canViewAllTasks) {
      query.recipient = user._id;
    }
    if (isRead !== undefined) {
      query.isRead = isRead === "true";
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .populate("sender", "name email")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      total,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
