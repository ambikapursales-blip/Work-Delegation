import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import User from "@/src/models/User";
import Activity from "@/src/models/Activity";

export async function GET(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (user.role !== "Admin" && user.role !== "HR") {
      query._id = user._id;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("name email role performanceScore grade email")
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({ success: true, total, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

export async function PUT(request) {
  await parseBody(request);
  await ensureDbConnection();
  const authUser = await getAuthUser(request);
  if (!["Manager", "Admin", "HR"].includes(authUser.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
}
