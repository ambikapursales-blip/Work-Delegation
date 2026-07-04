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

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const { status } = req.body;
    const eventId = req.params.id;
    const userId = user._id;

    if (!["Accepted", "Declined"].includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return finishRes(res);
    }

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return finishRes(res);
    }

    const assignment = event.assignedTo.find(
      (a) => a.employee.toString() === userId.toString(),
    );

    if (!assignment) {
      res.status(403).json({
        success: false,
        message: "You are not assigned to this event",
      });
      return finishRes(res);
    }

    assignment.status = status;
    await event.save();

    await Activity.create({
      user: userId,
      type: "event_rsvp",
      description: `RSVP for event "${event.title}" updated to ${status}`,
      entityId: event._id,
      entityType: "Event",
    });

    const updatedEvent = await Event.findById(eventId)
      .populate("createdBy", "name email")
      .populate("assignedTo.employee", "name email");

    res.status(200).json({ success: true, event: updatedEvent });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
