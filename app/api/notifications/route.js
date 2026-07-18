import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Notification from "@/src/models/Notification";
import { getScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (user.role !== "Super Admin" && !user.canViewAllTasks) {
      query.recipient = user._id;
    }
    if (isRead !== undefined) {
      query.isRead = isRead === "true";
    }

    const [result] = await Notification.aggregate([
      { $match: query },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "sender",
              },
            },
            { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                "sender.name": 1,
                "sender.email": 1,
                sender: 1,
                recipient: 1,
                type: 1,
                title: 1,
                message: 1,
                data: 1,
                entityId: 1,
                entityType: 1,
                isRead: 1,
                readAt: 1,
                actionUrl: 1,
                conversationId: 1,
                messageId: 1,
                priority: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;
    const notifications = result.data;

    res.status(200).json({
      success: true,
      total,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
