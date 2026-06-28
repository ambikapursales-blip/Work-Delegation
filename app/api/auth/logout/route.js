import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
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

    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export async function POST(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await logout(req, res);
  return finishRes(res);
}
