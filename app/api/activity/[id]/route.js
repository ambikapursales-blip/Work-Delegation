import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Activity from "@/src/models/Activity";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const activity = await Activity.findById(req.params.id).populate(
      "user",
      "name email",
    );

    if (!activity) {
      res.status(404).json({ success: false, message: "Activity not found" });
      return finishRes(res);
    }

    if (activity.user._id.toString() !== user._id.toString() && user.role !== "Super Admin" && !user.canViewAllTasks) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return finishRes(res);
    }

    res.status(200).json({ success: true, activity });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
