import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";
import Activity from "@/src/models/Activity";

const updateProfile = async (req, res) => {
  try {
    const { name, phone, department, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, department, avatar },
      { new: true, runValidators: true },
    );

    await Activity.create({
      user: req.user._id,
      type: "profile_updated",
      description: `${req.user.name} updated their profile`,
    });

    res.status(200).json({ success: true, user: user.getPublicProfile() });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

export async function PUT(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await updateProfile(req, res);
  return finishRes(res);
}
