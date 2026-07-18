import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import DWR from "@/src/models/DWR";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (user.role !== "Super Admin" && !user.canViewAllTasks && !user.canAssignTasks) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = { reviewStatus: "Pending Review" };

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
              $project: {
                "employee.name": 1,
                "employee.email": 1,
                "employee.employeeId": 1,
                "employee.role": 1,
                "employee.department": 1,
                employee: 1,
                reviewStatus: 1,
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
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
