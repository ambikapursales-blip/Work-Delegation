import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import User from "@/src/models/User";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import { verifyAcceptToken } from "@/src/utils/acceptToken";
import { ampCorsHeaders, ampJsonResponse } from "@/src/utils/amp";

async function processAccept(token) {
  const decoded = verifyAcceptToken(token);
  if (decoded.purpose !== "accept_task") {
    return { success: false, message: "Invalid token" };
  }

  const { taskId, userId } = decoded;

  await ensureDbConnection();
  const [task, user] = await Promise.all([
    Task.findById(taskId),
    User.findById(userId).select("name email"),
  ]);

  if (!task) return { success: false, message: "Task not found" };
  if (!user) return { success: false, message: "User not found" };

  const progressEntry = task.assigneeProgress.find(
    (p) => p.user?.toString() === userId,
  );
  if (!progressEntry) {
    return { success: false, message: "You are not assigned to this task" };
  }

  if (progressEntry.status !== "Pending" && progressEntry.status !== "On Hold") {
    return { success: true, message: `Task is already ${progressEntry.status.toLowerCase()}` };
  }

  progressEntry.status = "In Progress";
  await task.save();

  await Notification.create({
    recipient: task.assignedBy,
    sender: userId,
    title: "Task Accepted",
    message: `${user.name} accepted task "${task.title}"`,
    type: "task_updated",
    entityId: task._id,
    entityType: "Task",
  });

  await Activity.create({
    user: userId,
    type: "task_updated",
    description: `${user.name} accepted task "${task.title}" via email`,
    entityId: task._id,
    entityType: "Task",
  });

  return { success: true, message: `Task "${task.title}" has been accepted. Thank you!` };
}

export async function GET(request, { params }) {
  const { token } = params;

  try {
    const result = await processAccept(token);
    return htmlResponse(result.message, result.success);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return htmlResponse("This acceptance link has expired", false);
    }
    if (err.name === "JsonWebTokenError") {
      return htmlResponse("Invalid acceptance link", false);
    }
    return htmlResponse("Something went wrong", false);
  }
}

export async function POST(request, { params }) {
  const { token } = params;
  const isAmp = request.nextUrl.searchParams.get("amp") === "1";

  try {
    const result = await processAccept(token);
    if (isAmp) {
      return ampJsonResponse(result, { status: result.success ? 200 : 400 });
    }
    return htmlResponse(result.message, result.success);
  } catch (err) {
    const msg = err.name === "TokenExpiredError"
      ? "This link has expired"
      : err.name === "JsonWebTokenError" ? "Invalid link" : "Something went wrong";
    if (isAmp) {
      return ampJsonResponse({ success: false, message: msg }, { status: 400 });
    }
    return htmlResponse(msg, false);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: ampCorsHeaders() });
}

function htmlResponse(message, success) {
  const icon = success
    ? `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#A32424" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const color = success ? "#1F7A5C" : "#A32424";
  const title = success ? "Task Accepted" : "Unable to Accept";

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#FFF;border-radius:8px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  h1{font-size:20px;font-weight:bold;color:#12161C;margin:0 0 8px}
  p{font-size:14px;color:#2A2620;line-height:1.6;margin:0}
  .bar{height:4px;background:${color};border-radius:4px 4px 0 0;margin:-40px -40px 24px}
</style>
</head>
<body><div class="card"><div class="bar"></div>${icon}<h1>${title}</h1><p>${message}</p></div></body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
