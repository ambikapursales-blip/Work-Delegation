import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import Notification from "@/src/models/Notification";

export async function PUT(request, { params }) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
