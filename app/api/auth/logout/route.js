import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Attendance from "@/src/models/Attendance";
import Activity from "@/src/models/Activity";

const logout = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Attendance.findOneAndUpdate(
      { employee: req.user._id, date: today },
      { logoutTime: new Date() },
    );

    await Activity.create({
      user: req.user._id,
      type: "logout",
      description: `${req.user.name} logged out`,
      ipAddress: req.ip,
    });

    res
      .cookie("token", "", { maxAge: 0, httpOnly: true, sameSite: "lax" })
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await logout(req, res);
  return finishRes(res);
}
