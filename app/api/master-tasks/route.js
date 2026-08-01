import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import {
  getMasterTasks,
  createMasterTask,
} from "@/src/controllers/masterTaskController";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  // Read access is scoped in the controller: normal users only see
  // Master Tasks assigned to themselves; privileged users see all.
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await getMasterTasks(req, res);
  return finishRes(res);
}

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json(
      { success: false, message: "Not authorized to create master tasks" },
      { status: 403 },
    );
  }

  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await createMasterTask(req, res);
  return finishRes(res);
}