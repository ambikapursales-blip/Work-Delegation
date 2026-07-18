import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Activity from "@/src/models/Activity";
import { getScopeFilter } from "@/src/lib/taskScope";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, userId, type } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (userId && (user.role === "Super Admin" || user.canViewAllTasks)) {
      query.user = userId;
    } else {
      const scope = await getScopeFilter(user, "user");
      Object.assign(query, scope);
    }

    if (type) query.type = type;

    const [result] = await Activity.aggregate([
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
                localField: "user",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            {
              $project: {
                "user.name": 1,
                "user.email": 1,
                "user.role": 1,
                user: 1,
                type: 1,
                description: 1,
                metadata: 1,
                entityId: 1,
                entityType: 1,
                ipAddress: 1,
                userAgent: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;
    const activities = result.data;

    res
      .status(200)
      .json({ success: true, total, count: activities.length, activities });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
