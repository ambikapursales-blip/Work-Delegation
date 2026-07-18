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
  getTask,
  updateTask,
  deleteTask,
} from "@/src/controllers/taskController";
import Task from "@/src/models/Task";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await getTask(req, res);
  return finishRes(res);
}

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  const task = await Task.findById(req.params.id);
  if (task) {
    const isAssignee = task.assignedTo?.some((id) => id.toString() === user._id.toString());
    const isAssigner = task.assignedBy?.toString() === user._id.toString();
    if (!isAssignee && !isAssigner && user.role !== "Super Admin" && !user.canAssignTasks) {
      return NextResponse.json(
        { success: false, message: "Not authorized" },
        { status: 403 },
      );
    }
  }
  await updateTask(req, res);
  return finishRes(res);
}

export async function DELETE(request, { params }) {
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
  await deleteTask(req, res);
  return finishRes(res);
}
