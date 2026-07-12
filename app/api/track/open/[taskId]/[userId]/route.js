import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(request, { params }) {
  const { taskId, userId } = params;

  try {
    await ensureDbConnection();

    const task = await Task.findById(taskId);
    if (task) {
      const progress = task.assigneeProgress.find(
        (p) => p.user?.toString() === userId,
      );
      if (progress) {
        progress.emailOpened = true;
        if (!progress.openedAt) {
          progress.openedAt = new Date();
        }
        progress.openCount = (progress.openCount || 0) + 1;
        await task.save();
      }
    }
  } catch (err) {
    console.error("[TrackPixel] Error:", err.message);
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
