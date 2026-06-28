import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import {
  getTask,
  updateTask,
  deleteTask,
} from "@/src/controllers/taskController";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await getTask(req, res);
  return finishRes(res);
}

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await updateTask(req, res);
  return finishRes(res);
}

export async function DELETE(request, { params }) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  if (!["Manager", "Admin"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: `Role '${user.role}' is not authorized` },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await deleteTask(req, res);
  return finishRes(res);
}
