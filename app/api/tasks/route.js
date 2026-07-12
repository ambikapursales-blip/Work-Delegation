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
  getTasks,
  createTask,
} from "@/src/controllers/taskController";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await getTasks(req, res);
  return finishRes(res);
}

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  
  // Super Admin always has permission to assign tasks
  if (user.role === "Super Admin") {
    const req = createReq(request);
    req.user = user;
    const res = createRes();
    await createTask(req, res);
    return finishRes(res);
  }
  
  // For non-Super Admin users, check canAssignTasks permission
  if (!user.canAssignTasks) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to assign tasks" },
      { status: 403 },
    );
  }
  
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await createTask(req, res);
  return finishRes(res);
}
