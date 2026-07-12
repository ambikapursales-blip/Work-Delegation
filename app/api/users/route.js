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
  if (!["Super Admin", "Admin", "HR", "Manager"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { page, limit, search, sort, role: filterRole } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (filterRole) {
      query.role = filterRole;
    }

    let sortOption = { name: 1 };
    if (sort === "email") sortOption = { email: 1 };
    else if (sort === "role") sortOption = { role: 1 };
    else if (sort === "-name") sortOption = { name: -1 };
    else if (sort === "-email") sortOption = { email: -1 };
    else if (sort === "-role") sortOption = { role: -1 };

    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      const total = await User.countDocuments(query);
      const users = await User.find(query)
        .select("-password")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum);
      return res.status(200).json({
        success: true,
        count: users.length,
        total,
        page: pageNum,
        limit: limitNum,
        users,
      });
    }

    const users = await User.find(query)
      .select("-password")
      .sort(sortOption);
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
  if (!["Super Admin", "HR"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  try {
    const { name, email, password, role, department, phone, isActive, canAssignTasks } = req.body;

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
      role: role || "Sales",
      department,
      phone,
      isActive: isActive !== undefined ? isActive : true,
      canAssignTasks: canAssignTasks !== undefined ? canAssignTasks : false,
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
