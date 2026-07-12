import { NextResponse } from "next/server";
import { ensureDbConnection } from "@/src/lib/route-adapter";
import Task from "@/src/models/Task";
import User from "@/src/models/User";
import Notification from "@/src/models/Notification";
import Activity from "@/src/models/Activity";
import { verifyRejectToken } from "@/src/utils/rejectToken";
import { ampCorsHeaders, ampJsonResponse } from "@/src/utils/amp";

function pageHtml(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
  *,*:before,*:after{box-sizing:border-box}
  body{margin:0;padding:0;background:#F6F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#FFF;border-radius:8px;padding:40px;max-width:480px;width:90%;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .bar{height:4px;background:#B4611E;border-radius:4px 4px 0 0;margin:-40px -40px 24px}
  h1{font-size:20px;font-weight:bold;color:#12161C;margin:0 0 8px}
  p{font-size:14px;color:#2A2620;line-height:1.6;margin:0 0 20px}
  label{display:block;font-size:13px;font-weight:bold;color:#6B6558;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
  textarea{width:100%;padding:12px;border:1px solid #E7E3DA;border-radius:6px;font-size:14px;font-family:inherit;color:#2A2620;background:#FFF;resize:vertical;min-height:120px;outline:none}
  textarea:focus{border-color:#B4611E;box-shadow:0 0 0 2px rgba(180,97,30,0.15)}
  button{width:100%;padding:14px;border:none;border-radius:6px;font-size:14px;font-weight:bold;color:#FFF;background:#B4611E;cursor:pointer;margin-top:16px}
  button:hover{opacity:0.9}
</style>
</head>
<body><div class="card"><div class="bar"></div>${bodyContent}</div></body>
</html>`;
}

function resultHtml(message, success) {
  const icon = success
    ? `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg style="width:48px;height:48px;margin:0 auto 16px;display:block" viewBox="0 0 24 24" fill="none" stroke="#A32424" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const color = success ? "#1F7A5C" : "#A32424";
  const title = success ? "Task Declined" : "Unable to Decline";
  return `<!DOCTYPE html>
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
</html>`;
}

export async function GET(request, { params }) {
  const { token } = params;

  try {
    const decoded = verifyRejectToken(token);
    if (decoded.purpose !== "reject_task") {
      return new NextResponse(resultHtml("Invalid token", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { taskId, userId } = decoded;

    await ensureDbConnection();
    const [task, user] = await Promise.all([
      Task.findById(taskId).select("title"),
      User.findById(userId).select("name"),
    ]);

    if (!task) {
      return new NextResponse(resultHtml("Task not found", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (!user) {
      return new NextResponse(resultHtml("User not found", false), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const bodyContent = `
      <h1>Decline Task</h1>
      <p style="margin-bottom:4px">Task: <strong>${task.title}</strong></p>
      <p style="font-size:12px;color:#6B6558;margin-bottom:20px">Declining as ${user.name}</p>
      <form method="POST" action="/api/tasks/reject/${token}">
        <label for="reason">Reason for declining</label>
        <textarea id="reason" name="reason" maxlength="1000" required placeholder="Please provide a reason..."></textarea>
        <button type="submit">Submit</button>
      </form>
    `;

    return new NextResponse(pageHtml("Decline Task", bodyContent), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg =
      err.name === "TokenExpiredError"
        ? "This link has expired"
        : "Invalid link";
    return new NextResponse(resultHtml(msg, false), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export async function POST(request, { params }) {
  const { token } = params;
  const isAmp = request.nextUrl.searchParams.get("amp") === "1";

  const ampFail = (msg) => isAmp
    ? ampJsonResponse({ success: false, message: msg }, { status: 400 })
    : new NextResponse(resultHtml(msg, false), { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const ampOk = (msg) => isAmp
    ? ampJsonResponse({ success: true, message: msg })
    : new NextResponse(resultHtml(msg, true), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate" },
      });

  try {
    const decoded = verifyRejectToken(token);
    if (decoded.purpose !== "reject_task") {
      return ampFail("Invalid token");
    }

    const { taskId, userId } = decoded;

    const formData = await request.formData();
    const reason = (formData.get("reason") || "").trim();
    if (!reason) return ampFail("Reason cannot be empty");
    if (reason.length > 1000) return ampFail("Reason is too long (max 1000 characters)");

    await ensureDbConnection();
    const [task, user] = await Promise.all([
      Task.findById(taskId),
      User.findById(userId).select("name email"),
    ]);

    if (!task || !user) return ampFail("Task or user not found");

    const progressEntry = task.assigneeProgress.find(
      (p) => p.user?.toString() === userId,
    );
    if (!progressEntry) return ampFail("You are not assigned to this task");

    if (progressEntry.status !== "Pending") {
      return ampOk(`Task is already ${progressEntry.status.toLowerCase()}`);
    }

    progressEntry.status = "On Hold";

    task.history.push({
      status: "On Hold",
      changedBy: userId,
      changedAt: new Date(),
      note: `Declined via email: ${reason}`,
    });

    await task.save();

    await Notification.create({
      recipient: task.assignedBy,
      sender: userId,
      title: "Task Declined",
      message: `${user.name} declined task "${task.title}". Reason: ${reason}`,
      type: "task_updated",
      entityId: task._id,
      entityType: "Task",
    });

    await Activity.create({
      user: userId,
      type: "task_updated",
      description: `${user.name} declined task "${task.title}" via email. Reason: ${reason}`,
      entityId: task._id,
      entityType: "Task",
    });

    return ampOk(`Task "${task.title}" has been declined. The creator has been notified.`);
  } catch (err) {
    const msg = err.name === "TokenExpiredError" ? "This link has expired" : "Invalid link";
    return ampFail(msg);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: ampCorsHeaders() });
}
