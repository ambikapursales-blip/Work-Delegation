import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Event from "@/src/models/Event";
import Activity from "@/src/models/Activity";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("assignedTo.employee", "name email");

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
    } else {
      res.status(200).json({ success: true, event });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

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
    const {
      title, description, type, startDate, endDate, location,
      isVirtual, meetingLink, status, assignedTo, priority, tags,
    } = req.body;

    let formattedAssignedTo = undefined;
    if (assignedTo !== undefined) {
      formattedAssignedTo = assignedTo.map((userId) => ({
        employee: userId,
        status: "Pending",
      }));
    }

    const updateData = {
      title, description, type, startDate, endDate, location,
      isVirtual, meetingLink, status,
    };

    if (formattedAssignedTo !== undefined) updateData.assignedTo = formattedAssignedTo;
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;

    const event = await Event.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("assignedTo.employee", "name email");

    res.status(200).json({ success: true, event });
  } catch (error) {
    console.error("Error updating event:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}

export async function DELETE(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Manager", "Admin"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
