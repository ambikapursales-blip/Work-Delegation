import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Notification from "@/src/models/Notification";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const notification = await Notification.findById(req.params.id)
      .populate("sender", "name email")
      .populate("recipient", "name email");

    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return finishRes(res);
    }

    if (notification.recipient._id.toString() !== user._id.toString() && user.role !== "Super Admin" && !user.canViewAllTasks) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return finishRes(res);
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

export async function DELETE(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return finishRes(res);
    }

    if (notification.recipient.toString() !== user._id.toString() && user.role !== "Super Admin") {
      res.status(403).json({ success: false, message: "Not authorized" });
      return finishRes(res);
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
