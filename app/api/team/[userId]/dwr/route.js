import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { getEmployeeDWRs } from "@/src/controllers/teamController";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (user.role !== "Super Admin" && !user.canViewAllTasks && user._id.toString() !== params.userId) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await getEmployeeDWRs(req, res);
  return finishRes(res);
}
