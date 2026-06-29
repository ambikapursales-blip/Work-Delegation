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

export async function GET(request, { params }) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;
  const res = createRes();
  try {
    const found = await User.findById(req.params.id)
      .select("-password")
      .populate("managerId", "name email");
    if (!found) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(200).json({ success: true, user: found });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

export async function PUT(request, { params }) {
  await parseBody(request);
  await ensureDbConnection();
  const authUser = await requireAuth(request); if (authUser instanceof NextResponse) return authUser;
  if (!["Admin", "HR"].includes(authUser.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = authUser;
  const res = createRes();
  try {
    const { name, email, role, department, phone, isActive } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, department, phone, isActive },
      { new: true, runValidators: true },
    ).select("-password");
    res.status(200).json({ success: true, user: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}

export async function DELETE(request, { params }) {
  await ensureDbConnection();
  const authUser = await requireAuth(request); if (authUser instanceof NextResponse) return authUser;
  if (authUser.role !== "Admin") {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = authUser;
  const res = createRes();
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
