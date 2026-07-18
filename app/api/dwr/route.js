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
import Activity from "@/src/models/Activity";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (user.role !== "Super Admin" && !user.canViewAllTasks) {
      query.employee = user._id;
    }

    const [result] = await DWR.aggregate([
      { $match: query },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { date: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $lookup: {
                from: "users",
                localField: "employee",
                foreignField: "_id",
                as: "employee",
              },
            },
            { $unwind: "$employee" },
            {
              $lookup: {
                from: "tasks",
                localField: "completedTasks.task",
                foreignField: "_id",
                as: "completedTasks.task",
              },
            },
            {
              $lookup: {
                from: "tasks",
                localField: "pendingTasks.task",
                foreignField: "_id",
                as: "pendingTasks.task",
              },
            },
            {
              $project: {
                "employee.name": 1,
                "employee.email": 1,
                employee: 1,
                "completedTasks.task.title": 1,
                completedTasks: 1,
                "pendingTasks.task.title": 1,
                pendingTasks: 1,
                workSummary: 1,
                challenges: 1,
                nextDayPlan: 1,
                totalHoursWorked: 1,
                date: 1,
                submittedAt: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;
    const dwrs = result.data;

    res.status(200).json({ success: true, total, count: dwrs.length, dwrs });
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
      completedTasks,
      pendingTasks,
      workSummary,
      challenges,
      nextDayPlan,
      totalHoursWorked,
    } = req.body;

    const dwr = await DWR.create({
      employee: user._id,
      completedTasks,
      pendingTasks,
      workSummary,
      challenges,
      nextDayPlan,
      totalHoursWorked,
      submittedAt: new Date(),
    });

    await Activity.create({
      user: user._id,
      type: "dwr_submitted",
      description: `DWR submitted for ${new Date(dwr.date).toDateString()}`,
      entityId: dwr._id,
      entityType: "DWR",
    });

    res.status(201).json({ success: true, dwr });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
