import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import Activity from "@/src/models/Activity";

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const activity = await Activity.findById(req.params.id).populate(
      "user",
      "name email",
    );

    if (!activity) {
      res.status(404).json({ success: false, message: "Activity not found" });
    } else {
      res.status(200).json({ success: true, activity });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
