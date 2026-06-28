import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import { getPerformanceReport } from "@/src/controllers/reportController";

export async function GET(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  if (!["Admin", "Manager", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await getPerformanceReport(req, res);
  return finishRes(res);
}
