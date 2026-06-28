import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import Activity from "@/src/models/Activity";

export async function GET(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, userId, type } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (userId) {
      query.user = userId;
    } else if (user.role !== "Admin" && user.role !== "HR") {
      query.user = user._id;
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
