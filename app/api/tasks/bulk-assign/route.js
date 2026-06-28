import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import { bulkAssignTasks } from "@/src/controllers/taskController";

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await getAuthUser(request);
  if (!["Manager", "Admin", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: `Role '${user.role}' is not authorized` },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await bulkAssignTasks(req, res);
  return finishRes(res);
}
