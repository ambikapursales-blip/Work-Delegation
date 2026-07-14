import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Activity from "@/src/models/Activity";
import { getScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, userId, type } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (userId && (user.role === "Super Admin" || user.canViewAllTasks)) {
      query.user = userId;
    } else {
      const scope = await getScopeFilter(user, "user");
      Object.assign(query, scope);
    }

    if (type) query.type = type;

    const total = await Activity.countDocuments(query);
    const activities = await Activity.find(query)
      .populate("user", "name email role")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, total, count: activities.length, activities });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
