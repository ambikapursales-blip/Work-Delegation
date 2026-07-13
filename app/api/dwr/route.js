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
    if (user.role !== "Super Admin" && user.role !== "Admin" && user.role !== "HR") {
      query.employee = user._id;
    }

    const total = await DWR.countDocuments(query);
    const dwrs = await DWR.find(query)
      .populate([
        { path: "employee", select: "name email" },
        { path: "completedTasks.task", select: "title" },
        { path: "pendingTasks.task", select: "title" },
      ])
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ date: -1 });

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
