import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";
import Activity from "@/src/models/Activity";
import Attendance from "@/src/models/Attendance";
import { generateToken } from "@/src/middleware/auth";

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    }

    const user = await User.findOne({ email })
      .select("+password")
      .lean()
      .exec();

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Contact admin.",
      });
    }

    const bcryptjs = await import("bcryptjs");
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const [token] = await Promise.all([
      Promise.resolve(generateToken(user._id)),
      User.findByIdAndUpdate(
        user._id,
        { lastLogin: new Date(), lastActive: new Date() },
        { validateBeforeSave: false },
      )
        .lean()
        .exec(),
      Activity.create({
        user: user._id,
        type: "login",
        description: `${user.name} logged in`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch((err) => console.error("Activity log error:", err)),
      (async () => {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          await Attendance.findOneAndUpdate(
            { employee: user._id, date: today },
            {
              $setOnInsert: {
                employee: user._id,
                date: today,
                loginTime: new Date(),
                status: "Present",
              },
            },
            { upsert: true, new: true },
          )
            .lean()
            .exec();
        } catch (err) {
          console.error("Attendance update error:", err);
        }
      })(),
    ]);

    const { password: _, ...publicProfile } = user;

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        token,
        user: publicProfile,
      });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during login" });
  }
};

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const req = createReq(request);
  const res = createRes();
  await login(req, res);
  return finishRes(res);
}
