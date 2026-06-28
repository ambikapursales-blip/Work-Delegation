import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import { getAuthUser, authorize, generateToken } from "@/src/middleware/auth";
import User from "@/src/models/User";
import Activity from "@/src/models/Activity";

const register = async (req, res) => {
  try {
    const { name, email, password, role, department, phone, managerId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "Sales Executive",
      department,
      phone,
      managerId,
    });

    if (req.user) {
      await Activity.create({
        user: req.user._id,
        type: "user_created",
        description: `New user ${user.name} created with role ${user.role}`,
        entityId: user._id,
        entityType: "User",
      });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error during registration",
    });
  }
};

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const user = await getAuthUser(request);
  const roles = ["Admin", "HR"];
  if (!roles.includes(user.role)) {
    return NextResponse.json(
      { success: false, message: `Role '${user.role}' is not authorized to access this route` },
      { status: 403 },
    );
  }
  const req = createReq(request);
  req.user = user;
  const res = createRes();
  await register(req, res);
  return finishRes(res);
}
