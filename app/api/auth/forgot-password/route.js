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
import { sendPasswordResetOtp } from "@/src/utils/emailService";

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide an email address" });
    }

    const user = await User.findOne({ email }).exec();

    if (user) {
      const otp = crypto.randomInt(100000, 999999).toString();
      const hashedOtp = crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");

      user.resetPasswordToken = hashedOtp;
      user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
      user.resetPasswordAttempts = 0;
      await user.save();

      await sendPasswordResetOtp(email, user.name, otp);
    }

    return res.status(200).json({
      success: true,
      message: "If this email exists, OTP has been sent",
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      message: "If this email exists, OTP has been sent",
    });
  }
};

export async function POST(request) {
  await parseBody(request);
  await ensureDbConnection();
  const req = createReq(request);
  const res = createRes();
  await forgotPassword(req, res);
  return finishRes(res);
}
