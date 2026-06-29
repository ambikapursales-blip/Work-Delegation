import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "managerId",
      "name email role",
    );
    res.status(200).json({ success: true, user: user.getPublicProfile() });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await getMe(req, res);
  return finishRes(res);
}
