import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import DWR from "@/src/models/DWR";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Super Admin", "Manager", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const { reviewNote } = req.body;
    const dwr = await DWR.findById(req.params.id).populate("employee", "name email");

    if (!dwr) {
      res.status(404).json({ success: false, message: "DWR not found" });
      return finishRes(res);
    }

    if (dwr.reviewStatus === "Approved") {
      res.status(400).json({ success: false, message: "DWR already approved" });
      return finishRes(res);
    }

    dwr.reviewStatus = "Approved";
    dwr.reviewedBy = user._id;
    dwr.reviewNote = reviewNote;
    await dwr.save();

    await Notification.create({
      recipient: dwr?.employee?._id,
      sender: user._id,
      title: "DWR Approved",
      message: `Your DWR for ${new Date(dwr?.date).toDateString()} has been approved`,
      type: "performance_review",
      entityId: dwr._id,
      entityType: "DWR",
      actionUrl: `/dashboard/dwr/${dwr._id}`,
    });

    await Activity.create({
      user: user._id,
      type: "performance_updated",
      description: `${user.name} approved DWR for ${dwr?.employee?.name}`,
      entityId: dwr._id,
      entityType: "DWR",
    });

    res.status(200).json({ success: true, dwr });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
  return finishRes(res);
}
