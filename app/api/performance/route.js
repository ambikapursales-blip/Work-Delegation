import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";
import Activity from "@/src/models/Activity";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
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
  const authUser = await requireAuth(request); if (authUser instanceof NextResponse) return authUser;
  if (!["Manager", "Admin", "HR"].includes(authUser.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = authUser;
  const res = createRes();
  try {
    const { userId, performanceScore, grade } = req.body;
    const updated = await User.findByIdAndUpdate(
      userId,
      { performanceScore, grade },
      { new: true, runValidators: true },
    ).select("-password");
    if (!updated) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      await Activity.create({
        user: authUser._id,
        type: "performance_updated",
        description: `Performance updated for ${updated.name}`,
        entityId: updated._id,
        entityType: "User",
      });
      res.status(200).json({ success: true, user: updated });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
