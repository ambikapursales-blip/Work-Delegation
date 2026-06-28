import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import { addComment } from "@/src/controllers/taskController";

export async function POST(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  await addComment(req, res);
  return finishRes(res);
}
