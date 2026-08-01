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
  getMasterTask,
  updateMasterTask,
  deleteMasterTask,
} from "@/src/controllers/masterTaskController";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  // Ownership is enforced in the controller: normal users may only open
  // Master Tasks assigned to themselves; privileged users open any.
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await getMasterTask(req, res);
  return finishRes(res);
}

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await updateMasterTask(req, res);
  return finishRes(res);
}

export async function DELETE(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (user.role !== "Super Admin" && !user.canAssignTasks) {
    return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
  }

  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await deleteMasterTask(req, res);
  return finishRes(res);
}