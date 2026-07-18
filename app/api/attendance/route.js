import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Attendance from "@/src/models/Attendance";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20, date, employeeId } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (date) {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      query.date = dateObj;
    }

    const canQueryOtherUsers = user.role === "Super Admin" || user.canViewAllTasks;

    if (employeeId && canQueryOtherUsers) {
      query.employee = employeeId;
    } else if (!canQueryOtherUsers) {
      query.employee = user._id;
    }

    const [result] = await Attendance.aggregate([
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
                employee: 1,
                date: 1,
                status: 1,
                remarks: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;
    const records = result.data;

    res
      .status(200)
      .json({ success: true, total, count: records.length, records });
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
    const { date, status, remarks } = req.body;

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOneAndUpdate(
      { employee: user._id, date: attendanceDate },
      { status, remarks, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    res.status(201).json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
