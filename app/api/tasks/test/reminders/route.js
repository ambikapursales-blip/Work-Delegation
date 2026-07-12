import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { sendDeadlineAlerts } from "@/src/utils/cronJobs";

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Super Admin", "Admin", "Manager"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  try {
    await sendDeadlineAlerts();
    return NextResponse.json({
      success: true,
      message: "Deadline alert emails sent successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error sending reminder emails",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
