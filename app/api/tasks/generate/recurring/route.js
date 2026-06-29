import { NextResponse } from "next/server";
import {
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import { generateRecurringTasks } from "@/src/utils/cronJobs";

export async function POST(request) {
  await ensureDbConnection();
  const user = await requireAuth(request); if (user instanceof NextResponse) return user;
  if (user.role !== "Admin") {
    return NextResponse.json(
      { success: false, message: "Not authorized" },
      { status: 403 },
    );
  }
  try {
    await generateRecurringTasks();
    return NextResponse.json({
      success: true,
      message: "Recurring tasks generated successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error generating recurring tasks",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
