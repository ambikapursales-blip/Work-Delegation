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
import { sendEventInvitationEmail } from "@/src/utils/emailService";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;

    const [result] = await Event.aggregate([
      { $match: query },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { startDate: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $lookup: {
                from: "users",
                localField: "createdBy",
                foreignField: "_id",
                as: "createdBy",
              },
            },
            { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "users",
                localField: "assignedTo.employee",
                foreignField: "_id",
                as: "assignedTo.employee",
              },
            },
            {
              $project: {
                "createdBy.name": 1,
                "createdBy.email": 1,
                createdBy: 1,
                "assignedTo.employee.name": 1,
                "assignedTo.employee.email": 1,
                assignedTo: 1,
                title: 1,
                description: 1,
                type: 1,
                startDate: 1,
                endDate: 1,
                location: 1,
                isVirtual: 1,
                meetingLink: 1,
                priority: 1,
                tags: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;
    const events = result.data;

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
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
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

    // Send email invitations to assigned users
    if (assignedTo && assignedTo.length > 0) {
      const assignedUsers = await User.find({ _id: { $in: assignedTo } }).select('name email');
      
      const emailPromises = assignedUsers.map(async (assignedUser) => {
        try {
          await sendEventInvitationEmail(
            assignedUser.email,
            assignedUser.name,
            {
              title,
              description,
              type,
              startDate,
              endDate,
              location,
              isVirtual,
              meetingLink,
              priority,
            }
          );
        } catch (emailError) {
          console.error("[Events] Failed to send event invitation email:", emailError.message);
        }
      });
      await Promise.allSettled(emailPromises);
    }

    res.status(201).json({ success: true, event });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
