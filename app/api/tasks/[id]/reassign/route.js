import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { reassignTask } from "@/src/controllers/taskController";

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await reassignTask(req, res);
  return finishRes(res);
}
