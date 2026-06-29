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
  console.log("GET /api/tasks hit");
  console.log("Query:", Object.fromEntries(new URL(request.url).searchParams));
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  console.log("Auth user:", { id: user._id, role: user.role, name: user.name });
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
  if (!["Manager", "Admin", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: `Role '${user.role}' is not authorized` },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await createTask(req, res);
  return finishRes(res);
}
