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
import Task from "@/src/models/Task";
import DWR from "@/src/models/DWR";

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
  if (!["Super Admin", "Admin", "HR"].includes(authUser.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = authUser;
  const res = createRes();
  try {
    const { name, email, role, department, phone, isActive, canAssignTasks, password } = req.body;
    let updated;
    if (password) {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      if (name !== undefined) user.name = name;
      if (email !== undefined) user.email = email;
      if (role !== undefined) user.role = role;
      if (department !== undefined) user.department = department;
      if (phone !== undefined) user.phone = phone;
      if (isActive !== undefined) user.isActive = isActive;
      if (canAssignTasks !== undefined) user.canAssignTasks = canAssignTasks;
      user.password = password;
      await user.save();
      updated = user.getPublicProfile();
    } else {
      updated = await User.findByIdAndUpdate(
        req.params.id,
        { name, email, role, department, phone, isActive, canAssignTasks },
        { new: true, runValidators: true },
      ).select("-password");
    }
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
  if (authUser.role !== "Super Admin") {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request, params);
  req.user = authUser;
  const res = createRes();
  try {
    await Task.updateMany(
      { assignedTo: req.params.id },
      { $pull: { assignedTo: req.params.id } },
    );
    await Task.updateMany(
      { assignedBy: req.params.id },
      { $unset: { assignedBy: "" } },
    );
    await DWR.updateMany(
      { employee: req.params.id },
      { $unset: { employee: "" } },
    );
    await User.updateMany({ managerId: req.params.id }, { $unset: { managerId: "" } });
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}
