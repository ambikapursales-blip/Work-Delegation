import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Activity from "@/src/models/Activity";
import User from "@/src/models/User";

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Manager", "Admin", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const { performanceScore, grade, remarks } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.params.userId,
      { performanceScore, grade },
      { new: true, runValidators: true },
    ).select("-password");

    await Activity.create({
      user: user._id,
      type: "performance_updated",
      description: `Performance updated for ${updated.name}`,
      entityId: updated._id,
      entityType: "User",
    });

    res.status(200).json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
