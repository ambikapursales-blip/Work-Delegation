import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { getMasterTaskHistory } from "@/src/controllers/masterTaskController";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await getMasterTaskHistory(req, res);
  return finishRes(res);
}