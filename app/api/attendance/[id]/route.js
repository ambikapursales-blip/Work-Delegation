import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Attendance from "@/src/models/Attendance";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const attendance = await Attendance.findById(req.params.id).populate(
      "employee",
      "name email",
    );

    if (!attendance) {
      res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    } else {
      res.status(200).json({ success: true, attendance });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
