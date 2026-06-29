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

const updateLocation = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      location: { lat, lng, address, updatedAt: new Date() },
    });

    res.status(200).json({ success: true, message: "Location updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await updateLocation(req, res);
  return finishRes(res);
}
