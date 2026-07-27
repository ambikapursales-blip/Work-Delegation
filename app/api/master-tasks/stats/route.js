import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { getMasterTaskStats } from "@/src/controllers/masterTaskController";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await getMasterTaskStats(req, res);
  return finishRes(res);
}