import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Notification from "@/src/models/Notification";

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();

  try {
    await Notification.updateMany(
      { recipient: user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    return finishRes(res.status(200).json({ success: true, message: "All notifications marked as read" }));
  } catch (error) {
    return finishRes(res.status(500).json({ success: false, message: "Server error" }));
  }
}
