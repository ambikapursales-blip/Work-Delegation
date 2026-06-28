import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import Event from "@/src/models/Event";
import Activity from "@/src/models/Activity";

export async function GET(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate("createdBy", "name email")
      .populate("assignedTo.employee", "name email")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ startDate: -1 });

    res
      .status(200)
      .json({ success: true, total, count: events.length, events });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await getAuthUser(request);
  if (!["Manager", "Admin", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const {
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      isVirtual,
      meetingLink,
      assignedTo,
      priority,
      tags,
    } = req.body;

    const formattedAssignedTo = (assignedTo || []).map((userId) => ({
      employee: userId,
      status: "Pending",
    }));

    const event = await Event.create({
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      isVirtual,
      meetingLink,
      createdBy: user._id,
      assignedTo: formattedAssignedTo,
      priority: priority || "Medium",
      tags: tags || [],
    });

    await Activity.create({
      user: user._id,
      type: "event_created",
      description: `Event "${title}" created`,
      entityId: event._id,
      entityType: "Event",
    });

    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error("Error creating event:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
