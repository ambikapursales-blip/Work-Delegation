import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  ensureDbConnection,
  requireAuth,
  parseBody,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";
import Activity from "@/src/models/Activity";

export const dynamic = "force-dynamic";

export async function GET(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Admin", "HR", "Manager"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const users = await User.find().select("-password");
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
  return finishRes(res);
}

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Admin", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { name, email, password, role, department, phone, isActive } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    const newUser = await User.create({
      name,
      email,
      password,
      role: role || "Sales Executive",
      department,
      phone,
      isActive: isActive !== undefined ? isActive : true,
    });

    await Activity.create({
      user: user._id,
      type: "user_created",
      description: `New user ${newUser.name} created with role ${newUser.role}`,
      entityId: newUser._id,
      entityType: "User",
    });

    res.status(201).json({ success: true, user: newUser.getPublicProfile() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
  return finishRes(res);
}
