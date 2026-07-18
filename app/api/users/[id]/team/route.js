import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (user.role !== "Super Admin" && !user.canViewAllTasks) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const teamMembers = await User.find({ managerId: req.params.id }).select(
      "-password",
    );
    res
      .status(200)
      .json({ success: true, count: teamMembers.length, teamMembers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
