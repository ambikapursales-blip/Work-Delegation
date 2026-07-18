import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Message from "@/src/models/Message";
import Task from "@/src/models/Task";
import Conversation from "@/src/models/Conversation";
import User from "@/src/models/User";
import { getTaskScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;

  try {
    const taskScope = await getTaskScopeFilter(user);
    const userTasks = await Task.find(taskScope).select("_id").lean();

    const taskIds = userTasks.map((t) => t._id);

    if (taskIds.length === 0) {
      return finishRes(res.status(200).json({ success: true, totalUnread: 0 }));
    }

    const result = await Conversation.aggregate([
      {
        $match: {
          taskId: { $in: taskIds }
        }
      },
      {
        $lookup: {
          from: "messages",
          let: {
            taskId: "$taskId",
            userId: user._id,
            lastReadAt: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$participants",
                    cond: { $eq: ["$$this.userId", user._id] }
                  }
                },
                0
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$taskId", "$$taskId"] },
                    { $ne: ["$sender", "$$userId"] },
                    { $ne: ["$isDeleted", true] },
                    {
                      $cond: {
                        if: { $ne: ["$$lastReadAt.lastReadAt", null] },
                        then: { $gt: ["$createdAt", "$$lastReadAt.lastReadAt"] },
                        else: true
                      }
                    }
                  ]
                }
              }
            }
          ],
          as: "unreadMessages"
        }
      },
      {
        $group: {
          _id: null,
          totalUnread: { $sum: { $size: "$unreadMessages" } }
        }
      }
    ]);

    const totalUnread = result.length > 0 ? result[0].totalUnread : 0;

    return finishRes(res.status(200).json({ success: true, totalUnread }));
  } catch (error) {
    return finishRes(
      res.status(500).json({ success: false, message: "Server error" }),
    );
  }
}
