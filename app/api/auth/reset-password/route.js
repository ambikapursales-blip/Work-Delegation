import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
} from "@/src/lib/route-adapter";
import User from "@/src/models/User";

const MAX_ATTEMPTS = 5;

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, OTP, and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ email }).exec();

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    if (!user.resetPasswordToken || !user.resetPasswordExpire) {
      return res.status(400).json({
        success: false,
        message: "No reset request found. Please request a new OTP.",
      });
    }

    if (user.resetPasswordExpire < new Date()) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.resetPasswordAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (user.resetPasswordAttempts >= MAX_ATTEMPTS) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.resetPasswordAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Too many invalid attempts. Please request a new OTP.",
      });
    }

    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    if (hashedOtp !== user.resetPasswordToken) {
      user.resetPasswordAttempts += 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordAttempts = 0;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error during password reset" });
  }
};

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const req = createReq(request);
  const res = createRes();
  await resetPassword(req, res);
  return finishRes(res);
}
