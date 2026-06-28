import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser } from "@/src/middleware/auth";
import DWR from "@/src/models/DWR";
import User from "@/src/models/User";

export async function GET(request) {
  await ensureDbConnection();
  const user = await getAuthUser(request);
  if (!["Admin", "Manager", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = { reviewStatus: "Pending Review" };

    if (user.role === "Manager") {
      query.employee = { $in: [] };
      try {
        const teamMembers = await User.find({ managerId: user._id }).select("_id");
        if (teamMembers && teamMembers.length > 0) {
          const teamIds = teamMembers.map((m) => m._id);
          query.employee = { $in: teamIds };
        }
      } catch (userError) {
        console.error("Error fetching team members:", userError);
      }
    }

    const total = await DWR.countDocuments(query);
    const dwrs = await DWR.find(query)
      .populate("employee", "name email employeeId role department")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({ success: true, total, count: dwrs.length, dwrs });
  } catch (error) {
    console.error("Error fetching pending review DWRs:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
