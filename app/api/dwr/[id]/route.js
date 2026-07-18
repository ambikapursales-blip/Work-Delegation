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

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const dwr = await DWR.findById(req.params.id).populate([
      { path: "employee", select: "name email" },
      { path: "completedTasks.task", select: "title" },
      { path: "pendingTasks.task", select: "title" },
    ]);

    if (!dwr) {
      res.status(404).json({ success: false, message: "DWR not found" });
      return finishRes(res);
    }

    if (dwr.employee._id.toString() !== user._id.toString() && user.role !== "Super Admin" && !user.canViewAllTasks) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return finishRes(res);
    }

    res.status(200).json({ success: true, dwr });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const existing = await DWR.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, message: "DWR not found" });
      return finishRes(res);
    }

    if (existing.employee.toString() !== user._id.toString() && user.role !== "Super Admin" && !user.canAssignTasks) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return finishRes(res);
    }

    const {
      completedTasks,
      pendingTasks,
      workSummary,
      challenges,
      nextDayPlan,
      totalHoursWorked,
    } = req.body;

    const dwr = await DWR.findByIdAndUpdate(
      req.params.id,
      {
        completedTasks,
        pendingTasks,
        workSummary,
        challenges,
        nextDayPlan,
        totalHoursWorked,
      },
      { new: true, runValidators: true },
    ).populate("employee", "name email");

    res.status(200).json({ success: true, dwr });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
