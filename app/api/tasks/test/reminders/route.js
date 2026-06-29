import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { sendPendingTaskReminders } from "@/src/utils/cronJobs";

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (!["Admin", "Manager"].includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  try {
    await sendPendingTaskReminders();
    return NextResponse.json({
      success: true,
      message: "Pending task reminder emails sent successfully",
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
